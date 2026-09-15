import { IsIn, IsOptional, IsUUID } from "class-validator";
import { UserRole } from "@prisma/client";
import { ASSIGNABLE_ROLES } from "./create-staff-user.dto";

export class UpdateUserRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  hotelId?: string;
}
