import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportRangeDto } from "./dto/report-range.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels/:hotelId/reports", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
@Roles("ORG_ADMIN", "HOTEL_MANAGER")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("occupancy")
  occupancy(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Query() query: ReportRangeDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.reports.occupancy(hotelId, query.from, query.to, actor);
  }

  @Get("revenue")
  revenue(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Query() query: ReportRangeDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.reports.revenue(hotelId, query.from, query.to, actor);
  }
}
