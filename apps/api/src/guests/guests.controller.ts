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
import { GuestsService } from "./guests.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { UpdateGuestDto } from "./dto/update-guest.dto";
import { ListGuestsQueryDto } from "./dto/list-guests-query.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "guests", version: "1" })
@UseGuards(RolesGuard)
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Post()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  @Audit({ action: "GUEST_CREATED", entityType: "Guest" })
  create(@Body() dto: CreateGuestDto, @CurrentActor() actor: RequestActor) {
    return this.guests.create(dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  list(@Query() query: ListGuestsQueryDto, @CurrentActor() actor: RequestActor) {
    return this.guests.list(query.search, actor);
  }

  @Get(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.guests.get(id, actor);
  }

  @Patch(":id")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT")
  @Audit({ action: "GUEST_UPDATED", entityType: "Guest" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuestDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.guests.update(id, dto, actor);
  }
}
