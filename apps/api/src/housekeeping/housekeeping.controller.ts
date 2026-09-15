import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { HousekeepingService } from "./housekeeping.service";
import { UpdateHousekeepingTaskDto } from "./dto/update-housekeeping-task.dto";
import { AssignHousekeepingTaskDto } from "./dto/assign-housekeeping-task.dto";
import { ListHousekeepingTasksQueryDto } from "./dto/list-housekeeping-tasks-query.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels/:hotelId/housekeeping-tasks", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "HOUSEKEEPING_STAFF", "FRONT_DESK_AGENT")
  list(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Query() query: ListHousekeepingTasksQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.housekeeping.list(hotelId, query.status, actor);
  }

  @Patch(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "HOUSEKEEPING_STAFF")
  @Audit({ action: "HOUSEKEEPING_TASK_UPDATED", entityType: "HousekeepingTask" })
  update(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHousekeepingTaskDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.housekeeping.update(hotelId, id, dto, actor);
  }

  @Post(":id/assign")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "HOUSEKEEPING_TASK_ASSIGNED", entityType: "HousekeepingTask" })
  assign(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignHousekeepingTaskDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.housekeeping.assign(hotelId, id, dto, actor);
  }
}
