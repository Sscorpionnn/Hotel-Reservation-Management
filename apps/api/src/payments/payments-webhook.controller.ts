import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { PaymentsService, InboundWebhookEvent } from "./payments.service";
import { PAYMENT_PROVIDER, PaymentProvider } from "./providers/payment-provider.interface";

@Controller({ path: "payments/webhook", version: "1" })
export class PaymentsWebhookController {
  constructor(
    private readonly payments: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Public()
  @Post()
  // Generous but bounded — protects the endpoint from being used for
  // volumetric abuse while still tolerating a burst of legitimate
  // redeliveries from the provider after a transient outage.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hrms-signature") signature?: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException("Missing request body");

    // Throws UnauthorizedException on bad/missing signature or a
    // timestamp outside the replay-protection tolerance window.
    this.provider.verifyWebhookSignature(rawBody, signature);

    const event = parseEvent(rawBody);
    await this.payments.handleWebhookEvent(rawBody, event);
    return { received: true };
  }
}

function parseEvent(rawBody: Buffer): InboundWebhookEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new BadRequestException("Invalid JSON payload");
  }
  const body = parsed as Partial<InboundWebhookEvent>;
  if (
    !body ||
    typeof body.id !== "string" ||
    (body.type !== "payment_intent.succeeded" && body.type !== "payment_intent.failed") ||
    !body.data ||
    typeof body.data.providerRef !== "string"
  ) {
    throw new BadRequestException("Malformed webhook event");
  }
  return body as InboundWebhookEvent;
}
