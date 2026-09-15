import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AvailabilityService } from "./availability.service";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import type { RequestActor } from "../common/tenant/tenant-context";
import { AvailabilityQueryDto } from "./dto/availability-query.dto";

@Controller({ path: "hotels/:hotelId/availability", version: "1" })
@UseGuards(HotelScopeGuard)
@UseInterceptors(CacheInterceptor)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @CacheTTL(15)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Query() query: AvailabilityQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.availability.search(hotelId, query.checkInDate, query.checkOutDate, actor);
  }
}
