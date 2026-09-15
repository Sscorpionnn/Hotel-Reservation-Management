import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { assertTransitionAllowed } from "./reservation-state-machine";
import type { RequestActor } from "../common/tenant/tenant-context";
import { ReservationsGateway } from "./reservations.gateway";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";

export const HOLD_EXPIRY_QUEUE = "reservation-hold-expiry";
const HOLD_TTL_MINUTES = 15;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ReservationsGateway,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @InjectQueue(HOLD_EXPIRY_QUEUE) private readonly holdExpiryQueue: Queue,
  ) {}

  /**
   * Creates a HELD reservation, auto-assigning `roomsRequested` physical
   * rooms of the given room type for every night of the stay.
   *
   * Concurrency safety: assignment happens inside one DB transaction, and
   * the actual guarantee against double-booking is a partial unique index
   * on (room_id, stay_date) WHERE released_at IS NULL — see migration
   * `add_reservation_night_unique_index`. If two requests race for the
   * last room, Postgres itself rejects the loser's INSERT with a unique
   * violation (P2002); the transaction rolls back atomically and the
   * caller gets a 409. No application-level locking is required for
   * correctness — the constraint is authoritative even under concurrent
   * transactions on different connections.
   */
  async createHold(dto: CreateHoldDto, actor: RequestActor) {
    const checkIn = toDateOnly(dto.checkInDate);
    const checkOut = toDateOnly(dto.checkOutDate);
    if (checkOut <= checkIn) {
      throw new BadRequestException("checkOutDate must be after checkInDate");
    }
    const today = toDateOnly(new Date().toISOString());
    if (checkIn < today) {
      throw new BadRequestException("checkInDate cannot be in the past");
    }

    const existing = await this.prisma.reservation.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { nights: true },
    });
    if (existing) {
      if (existing.hotelId !== dto.hotelId || existing.guestId !== dto.guestId) {
        throw new ConflictException("Idempotency key already used for a different reservation");
      }
      return existing;
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: { id: dto.hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");

    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, hotelId: dto.hotelId, isActive: true },
    });
    if (!roomType) throw new NotFoundException("Room type not found");

    const stayDates = enumerateDates(checkIn, checkOut);

    const promotion = dto.promotionCode
      ? await this.resolvePromotion(dto.promotionCode, actor.organizationId, dto.hotelId)
      : null;

    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        const candidateRooms = await tx.room.findMany({
          where: { hotelId: dto.hotelId, roomTypeId: dto.roomTypeId, status: "AVAILABLE" },
          orderBy: { roomNumber: "asc" },
        });
        if (candidateRooms.length < dto.roomsRequested) {
          throw new NoAvailabilityError();
        }

        // Created up front (status HELD, zeroed totals) so ReservationNight
        // rows — which carry a NOT NULL foreign key to it — can be inserted
        // as rooms are assigned below. It only becomes visible to other
        // transactions once this whole transaction commits, so a request
        // that ultimately fails to find enough rooms rolls this back too;
        // no other caller ever observes a partially-assigned hold.
        const created = await tx.reservation.create({
          data: {
            hotelId: dto.hotelId,
            guestId: dto.guestId,
            status: "HELD",
            checkInDate: checkIn,
            checkOutDate: checkOut,
            adults: dto.adults,
            children: dto.children,
            currency: hotel.currency,
            subtotalCents: 0,
            discountCents: 0,
            totalCents: 0,
            promotionId: promotion?.id,
            idempotencyKey: dto.idempotencyKey,
            holdExpiresAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60_000),
            createdByUserId: actor.userId,
          },
        });

        const assignedNights: { roomId: string; stayDate: Date; rateCents: number }[] = [];
        const assignedRoomIds: string[] = [];

        for (const room of candidateRooms) {
          if (assignedRoomIds.length === dto.roomsRequested) break;

          const nightsForRoom = await Promise.all(
            stayDates.map((date) =>
              this.priceForNight(tx, dto.roomTypeId, date, roomType.basePriceCents),
            ),
          );

          try {
            // Bulk INSERT for every night of this room in one statement —
            // if ANY night is already taken, the whole insert fails and
            // nothing for this room is persisted, so we can safely retry
            // with the next candidate room.
            await tx.reservationNight.createMany({
              data: stayDates.map((date, i) => ({
                reservationId: created.id,
                roomId: room.id,
                stayDate: date,
                rateCents: nightsForRoom[i],
              })),
            });
            assignedRoomIds.push(room.id);
            stayDates.forEach((date, i) =>
              assignedNights.push({ roomId: room.id, stayDate: date, rateCents: nightsForRoom[i] }),
            );
          } catch (error) {
            if (isUniqueConstraintError(error)) {
              // Room got taken by a concurrent transaction between our
              // SELECT and INSERT — move on to the next candidate.
              continue;
            }
            throw error;
          }
        }

        if (assignedRoomIds.length < dto.roomsRequested) {
          throw new NoAvailabilityError();
        }

        const subtotalCents = assignedNights.reduce((sum, n) => sum + n.rateCents, 0);
        const discountCents = promotion
          ? computeDiscount(subtotalCents, promotion.discountType, promotion.discountValue)
          : 0;
        const totalCents = Math.max(subtotalCents - discountCents, 0);

        await tx.reservation.update({
          where: { id: created.id },
          data: { subtotalCents, discountCents, totalCents },
        });

        if (promotion) {
          await tx.promotion.update({
            where: { id: promotion.id },
            data: { redemptionCount: { increment: 1 } },
          });
        }

        return tx.reservation.findUniqueOrThrow({
          where: { id: created.id },
          include: { nights: true },
        });
      });

      await this.holdExpiryQueue.add(
        "expire",
        { reservationId: reservation.id },
        { delay: HOLD_TTL_MINUTES * 60_000, jobId: reservation.id },
      );

      this.gateway.broadcastAvailabilityChanged(dto.hotelId, dto.roomTypeId);
      await this.audit.record({
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "RESERVATION_HELD",
        entityType: "Reservation",
        entityId: reservation.id,
      });

      return reservation;
    } catch (error) {
      if (error instanceof NoAvailabilityError) {
        throw new ConflictException("No rooms available for the selected dates");
      }
      if (isUniqueConstraintError(error) && hasTarget(error, "idempotencyKey")) {
        // Two concurrent requests carrying the same client-generated
        // idempotency key raced past the pre-check above; the loser lands
        // here instead of creating a duplicate reservation.
        const winner = await this.prisma.reservation.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { nights: true },
        });
        if (winner) return winner;
      }
      throw error;
    }
  }

  async confirm(reservationId: string, actor: RequestActor) {
    const reservation = await this.getScoped(reservationId, actor);
    assertTransitionAllowed(reservation.status, "CONFIRMED");

    const result = await this.prisma.reservation.updateMany({
      where: { id: reservationId, status: "HELD" },
      data: { status: "CONFIRMED", holdExpiresAt: null, version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new ConflictException("Reservation is no longer in a holdable state");
    }

    await this.holdExpiryQueue.remove(reservationId).catch(() => undefined);
    await this.audit.record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "RESERVATION_CONFIRMED",
      entityType: "Reservation",
      entityId: reservationId,
    });
    await this.notifications.enqueue({
      organizationId: actor.organizationId,
      recipientType: "GUEST",
      recipientId: reservation.guestId,
      channel: "EMAIL",
      template: "reservation_confirmed",
      payload: { reservationId },
    });
    return this.getScoped(reservationId, actor);
  }

  async cancel(reservationId: string, reason: string | undefined, actor: RequestActor) {
    const reservation = await this.getScoped(reservationId, actor);
    assertTransitionAllowed(reservation.status, "CANCELLED");

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.reservation.updateMany({
        where: { id: reservationId, status: reservation.status },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new ConflictException("Reservation state changed concurrently, please retry");
      }
      // Freeing the nights here — not on a delay — means the rooms become
      // bookable again immediately.
      await tx.reservationNight.updateMany({
        where: { reservationId, releasedAt: null },
        data: { releasedAt: new Date() },
      });
    });

    await this.holdExpiryQueue.remove(reservationId).catch(() => undefined);
    this.gateway.broadcastAvailabilityChanged(reservation.hotelId, null);
    await this.audit.record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "RESERVATION_CANCELLED",
      entityType: "Reservation",
      entityId: reservationId,
      metadata: { reason },
    });
    await this.notifications.enqueue({
      organizationId: actor.organizationId,
      recipientType: "GUEST",
      recipientId: reservation.guestId,
      channel: "EMAIL",
      template: "reservation_cancelled",
      payload: { reservationId, reason: reason ?? null },
    });
    return this.getScoped(reservationId, actor);
  }

  async checkIn(reservationId: string, actor: RequestActor) {
    const reservation = await this.getScoped(reservationId, actor);
    assertTransitionAllowed(reservation.status, "CHECKED_IN");

    const result = await this.prisma.reservation.updateMany({
      where: { id: reservationId, status: "CONFIRMED" },
      data: { status: "CHECKED_IN", checkedInAt: new Date(), version: { increment: 1 } },
    });
    if (result.count === 0) throw new ConflictException("Reservation is not confirmed");

    await this.audit.record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "RESERVATION_CHECKED_IN",
      entityType: "Reservation",
      entityId: reservationId,
    });
    return this.getScoped(reservationId, actor);
  }

  async checkOut(reservationId: string, actor: RequestActor) {
    const reservation = await this.getScoped(reservationId, actor);
    assertTransitionAllowed(reservation.status, "CHECKED_OUT");

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.reservation.updateMany({
        where: { id: reservationId, status: "CHECKED_IN" },
        data: { status: "CHECKED_OUT", checkedOutAt: new Date(), version: { increment: 1 } },
      });
      if (result.count === 0) throw new ConflictException("Reservation is not checked in");

      const roomIds = [...new Set(reservation.nights.map((n) => n.roomId))];
      for (const roomId of roomIds) {
        await tx.housekeepingTask.create({
          data: { hotelId: reservation.hotelId, roomId, status: "DIRTY" },
        });
      }
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "RESERVATION_CHECKED_OUT",
      entityType: "Reservation",
      entityId: reservationId,
    });
    return this.getScoped(reservationId, actor);
  }

  /** Invoked by the BullMQ processor when a hold's TTL elapses. */
  async expireHold(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "HELD") return;

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.reservation.updateMany({
        where: { id: reservationId, status: "HELD" },
        data: { status: "EXPIRED", version: { increment: 1 } },
      });
      if (result.count === 0) return;
      await tx.reservationNight.updateMany({
        where: { reservationId, releasedAt: null },
        data: { releasedAt: new Date() },
      });
    });

    this.logger.log(`Reservation ${reservationId} hold expired and rooms released`);
    this.gateway.broadcastAvailabilityChanged(reservation.hotelId, null);
  }

  async getScoped(reservationId: string, actor: RequestActor) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { nights: true, payments: true },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const hotel = await this.prisma.hotel.findUnique({ where: { id: reservation.hotelId } });
    if (!hotel || hotel.organizationId !== actor.organizationId) {
      // Same response as "not found" — never confirm to an out-of-tenant
      // caller that a given reservation id exists elsewhere (avoids IDOR
      // enumeration).
      throw new NotFoundException("Reservation not found");
    }
    if (
      (actor.role === "HOTEL_MANAGER" ||
        actor.role === "FRONT_DESK_AGENT" ||
        actor.role === "HOUSEKEEPING_STAFF") &&
      actor.hotelId !== reservation.hotelId
    ) {
      throw new ForbiddenException("You are not assigned to this hotel");
    }
    return reservation;
  }

  private async priceForNight(
    tx: Prisma.TransactionClient,
    roomTypeId: string,
    date: Date,
    fallbackCents: number,
  ): Promise<number> {
    const rate = await tx.ratePlan.findFirst({
      where: { roomTypeId, startDate: { lte: date }, endDate: { gte: date } },
      orderBy: { priceCents: "asc" },
    });
    return rate?.priceCents ?? fallbackCents;
  }

  private async resolvePromotion(code: string, organizationId: string, hotelId: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        organizationId,
        code,
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
        OR: [{ hotelId: null }, { hotelId }],
      },
    });
    if (!promotion) throw new BadRequestException("Promotion code is invalid or expired");
    if (promotion.maxRedemptions && promotion.redemptionCount >= promotion.maxRedemptions) {
      throw new BadRequestException("Promotion has reached its redemption limit");
    }
    return promotion;
  }
}

class NoAvailabilityError extends Error {}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function hasTarget(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : target === field;
}

function toDateOnly(isoDate: string): Date {
  const d = new Date(isoDate);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function enumerateDates(start: Date, endExclusive: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor < endExclusive) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function computeDiscount(
  subtotalCents: number,
  type: "PERCENTAGE" | "FIXED_AMOUNT",
  value: number,
): number {
  if (type === "PERCENTAGE") return Math.round((subtotalCents * value) / 100);
  return Math.min(value, subtotalCents);
}
