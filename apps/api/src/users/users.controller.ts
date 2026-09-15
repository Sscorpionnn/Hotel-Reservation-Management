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
import { UsersService } from "./users.service";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { CurrentActor } from "../common/decorators/current-actor.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Audit } from "../common/decorators/audit.decorator";
import type { RequestActor } from "../common/tenant/tenant-context";

@Controller({ path: "users", version: "1" })
@UseGuards(RolesGuard)
@Roles("ORG_ADMIN")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @Audit({ action: "STAFF_USER_CREATED", entityType: "User" })
  create(@Body() dto: CreateStaffUserDto, @CurrentActor() actor: RequestActor) {
    return this.users.create(dto, actor);
  }

  @Get()
  list(@CurrentActor() actor: RequestActor) {
    return this.users.list(actor);
  }

  @Patch(":id/role")
  @Audit({ action: "STAFF_USER_ROLE_UPDATED", entityType: "User" })
  updateRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.users.updateRole(id, dto, actor);
  }

  @Patch(":id/suspend")
  @Audit({ action: "STAFF_USER_SUSPENDED", entityType: "User" })
  suspend(@Param("id", ParseUUIDPipe) id: string, @CurrentActor() actor: RequestActor) {
    return this.users.suspend(id, actor);
  }
}
