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
import { PromotionsService } from "./promotions.service";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "promotions", version: "1" })
@UseGuards(RolesGuard)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Post()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "PROMOTION_CREATED", entityType: "Promotion" })
  create(@Body() dto: CreatePromotionDto, @CurrentActor() actor: RequestActor) {
    return this.promotions.create(dto, actor);
  }

  @Get()
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  list(@CurrentActor() actor: RequestActor) {
    return this.promotions.list(actor);
  }

  @Patch(":id/deactivate")
  @Roles("ORG_ADMIN", "HOTEL_MANAGER")
  @Audit({ action: "PROMOTION_DEACTIVATED", entityType: "Promotion" })
  deactivate(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.promotions.deactivate(id, actor);
  }
}
