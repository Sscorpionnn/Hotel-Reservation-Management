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
import { RoomTypesService } from "./room-types.service";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels/:hotelId/room-types", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Post()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "ROOM_TYPE_CREATED", entityType: "RoomType" })
  create(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateRoomTypeDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.roomTypes.create(hotelId, dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  list(@Param("hotelId", ParseUUIDPipe) hotelId: string, @CurrentActor() actor: RequestActor) {
    return this.roomTypes.list(hotelId, actor);
  }

  @Get(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "GUEST_PORTAL")
  get(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.roomTypes.get(hotelId, id, actor);
  }

  @Patch(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "ROOM_TYPE_UPDATED", entityType: "RoomType" })
  update(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomTypeDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.roomTypes.update(hotelId, id, dto, actor);
  }
}
