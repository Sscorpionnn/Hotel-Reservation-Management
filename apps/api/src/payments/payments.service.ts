import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ReservationsService } from "../reservations/reservations.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PAYMENT_PROVIDER, PaymentProvider } from "./providers/payment-provider.interface";
import type { RequestActor } from "../common/tenant/tenant-context";

export interface InboundWebhookEvent {
  id: string;
  type: "payment_intent.succeeded" | "payment_intent.failed";
  data: {
    providerRef: string;
    cardBrand?: string;
    cardLast4?: string;
    failureReason?: string;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reservations: ReservationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async createIntent(dto: CreatePaymentIntentDto, actor: RequestActor) {
    const existing = await this.prisma.paymentIntent.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    const reservation = await this.reservations.getScoped(dto.reservationId, actor);
    if (reservation.status !== "HELD") {
      throw new BadRequestException("Reservation is not awaiting payment");
    }

    const providerIntent = await this.provider.createPaymentIntent({
      amountCents: reservation.totalCents,
      currency: reservation.currency,
      idempotencyKey: dto.idempotencyKey,
      metadata: { reservationId: reservation.id },
    });

    try {
      const created = await this.prisma.paymentIntent.create({
        data: {
          reservationId: reservation.id,
          provider: this.provider.name,
          providerRef: providerIntent.providerRef,
          status: providerIntent.status,
          amountCents: reservation.totalCents,
          currency: reservation.currency,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      await this.audit.record({
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "PAYMENT_INTENT_CREATED",
        entityType: "PaymentIntent",
        entityId: created.id,
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await this.prisma.paymentIntent.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (winner) return winner;
      }
      throw error;
    }
  }

  /**
   * Processes a verified webhook payload. Idempotency + replay protection
   * is enforced by the unique (provider, providerEventId) constraint on
   * PaymentWebhookEvent — a redelivered event id is recorded as already
   * processed and the handler becomes a no-op, so a captured payment can
   * never be double-applied even if the gateway retries the same event.
   */
  async handleWebhookEvent(rawBody: Buffer, event: InboundWebhookEvent): Promise<void> {
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");

    const alreadyProcessed = await this.prisma.$transaction(async (tx) => {
      const record = await tx.paymentWebhookEvent.findUnique({
        where: {
          provider_providerEventId: { provider: this.provider.name, providerEventId: event.id },
        },
      });
      if (record) return true;

      await tx.paymentWebhookEvent.create({
        data: {
          provider: this.provider.name,
          providerEventId: event.id,
          signatureValid: true,
          payloadHash,
        },
      });
      return false;
    });

    if (alreadyProcessed) {
      this.logger.warn(`Ignoring replayed webhook event ${event.id}`);
      return;
    }

    const intent = await this.prisma.paymentIntent.findFirst({
      where: { providerRef: event.data.providerRef },
    });
    if (!intent) {
      this.logger.warn(`Webhook for unknown payment intent ${event.data.providerRef}`);
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const result = await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: { in: ["PENDING", "REQUIRES_ACTION"] } },
        data: {
          status: "CAPTURED",
          cardBrand: event.data.cardBrand,
          cardLast4: event.data.cardLast4,
        },
      });
      if (result.count > 0) {
        await this.reservations
          .confirm(intent.reservationId, await this.systemActorFor(intent.reservationId))
          .catch((error) =>
            this.logger.error(
              `Failed to auto-confirm reservation after payment capture: ${error.message}`,
            ),
          );
      }
    } else if (event.type === "payment_intent.failed") {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: { in: ["PENDING", "REQUIRES_ACTION"] } },
        data: { status: "FAILED", failureReason: event.data.failureReason },
      });
    }
  }

  private async systemActorFor(reservationId: string): Promise<RequestActor> {
    const reservation = await this.prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { hotel: true },
    });
    return {
      userId: "system:payment-webhook",
      organizationId: reservation.hotel.organizationId,
      hotelId: reservation.hotelId,
      role: "ORG_ADMIN",
    };
  }
}
