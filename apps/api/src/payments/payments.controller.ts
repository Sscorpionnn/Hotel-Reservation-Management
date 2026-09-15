import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PaymentsService } from "./payments.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "payments/intents", version: "1" })
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  @Audit({ action: "PAYMENT_INTENT_REQUESTED", entityType: "PaymentIntent" })
  create(@Body() dto: CreatePaymentIntentDto, @CurrentActor() actor: RequestActor) {
    return this.payments.createIntent(dto, actor);
  }
}
