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
import { HotelsService } from "./hotels.service";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { UpdateHotelDto } from "./dto/update-hotel.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "hotels", version: "1" })
@UseGuards(RolesGuard)
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Post()
  @Roles("ORG_ADMIN")
  @Audit({ action: "HOTEL_CREATED", entityType: "Hotel" })
  create(@Body() dto: CreateHotelDto, @CurrentActor() actor: RequestActor) {
    return this.hotels.create(dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF")
  list(@CurrentActor() actor: RequestActor) {
    return this.hotels.list(actor);
  }

  @Get(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF")
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.hotels.get(id, actor);
  }

  @Patch(":id")
  @Roles("ORG_ADMIN")
  @Audit({ action: "HOTEL_UPDATED", entityType: "Hotel" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotelDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.hotels.update(id, dto, actor);
  }
}
