import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RatesService } from "./rates.service";
import { CreateRatePlanDto } from "./dto/create-rate-plan.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels/:hotelId/room-types/:roomTypeId/rate-plans", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Post()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "RATE_PLAN_CREATED", entityType: "RatePlan" })
  create(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("roomTypeId", ParseUUIDPipe) roomTypeId: string,
    @Body() dto: CreateRatePlanDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rates.create(hotelId, roomTypeId, dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  list(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("roomTypeId", ParseUUIDPipe) roomTypeId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rates.list(hotelId, roomTypeId, actor);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "RATE_PLAN_DELETED", entityType: "RatePlan" })
  remove(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("roomTypeId", ParseUUIDPipe) roomTypeId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rates.remove(hotelId, roomTypeId, id, actor);
  }
}
