import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ReservationsService } from "./reservations.service";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { CancelReservationDto } from "./dto/cancel-reservation.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "reservations", version: "1" })
@UseGuards(RolesGuard)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  @Audit({ action: "RESERVATION_HOLD_REQUESTED", entityType: "Reservation" })
  create(@Body() dto: CreateHoldDto, @CurrentActor() actor: RequestActor) {
    return this.reservations.createHold(dto, actor);
  }

  @Get(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.reservations.getScoped(id, actor);
  }

  @Patch(":id/confirm")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  @Audit({ action: "RESERVATION_CONFIRM_REQUESTED", entityType: "Reservation" })
  confirm(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.reservations.confirm(id, actor);
  }

  @Patch(":id/cancel")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  @Audit({ action: "RESERVATION_CANCEL_REQUESTED", entityType: "Reservation" })
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.reservations.cancel(id, dto.reason, actor);
  }

  @Patch(":id/check-in")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  @Audit({ action: "RESERVATION_CHECK_IN_REQUESTED", entityType: "Reservation" })
  checkIn(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.reservations.checkIn(id, actor);
  }

  @Patch(":id/check-out")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  @Audit({ action: "RESERVATION_CHECK_OUT_REQUESTED", entityType: "Reservation" })
  checkOut(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.reservations.checkOut(id, actor);
  }
}
