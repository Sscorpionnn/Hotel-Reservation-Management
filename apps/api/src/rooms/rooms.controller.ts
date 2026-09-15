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
import { RoomsService } from "./rooms.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { ListRoomsQueryDto } from "./dto/list-rooms-query.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels/:hotelId/rooms", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "ROOM_CREATED", entityType: "Room" })
  create(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateRoomDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rooms.create(hotelId, dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF")
  list(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Query() query: ListRoomsQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rooms.list(hotelId, query.status, actor);
  }

  @Get(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF")
  get(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rooms.get(hotelId, id, actor);
  }

  @Patch(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "ROOM_UPDATED", entityType: "Room" })
  update(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.rooms.update(hotelId, id, dto, actor);
  }
}
