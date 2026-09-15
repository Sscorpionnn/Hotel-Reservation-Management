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
  Put,
  UseGuards,
} from "@nestjs/common";
import { AmenitiesService } from "./amenities.service";
import { CreateAmenityDto } from "./dto/create-amenity.dto";
import { SetRoomTypeAmenitiesDto } from "./dto/set-room-type-amenities.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HotelScopeGuard } from "../common/guards/hotel-scope.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels/:hotelId/amenities", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Post()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "AMENITY_CREATED", entityType: "Amenity" })
  create(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Body() dto: CreateAmenityDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.amenities.create(hotelId, dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF", "GUEST_PORTAL")
  list(@Param("hotelId", ParseUUIDPipe) hotelId: string, @CurrentActor() actor: RequestActor) {
    return this.amenities.list(hotelId, actor);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "AMENITY_DELETED", entityType: "Amenity" })
  remove(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.amenities.remove(hotelId, id, actor);
  }
}

@Controller({ path: "hotels/:hotelId/room-types/:roomTypeId/amenities", version: "1" })
@UseGuards(RolesGuard, HotelScopeGuard)
export class RoomTypeAmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Put()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "ROOM_TYPE_AMENITIES_SET", entityType: "RoomType" })
  set(
    @Param("hotelId", ParseUUIDPipe) hotelId: string,
    @Param("roomTypeId", ParseUUIDPipe) roomTypeId: string,
    @Body() dto: SetRoomTypeAmenitiesDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.amenities.setRoomTypeAmenities(hotelId, roomTypeId, dto, actor);
  }
}
