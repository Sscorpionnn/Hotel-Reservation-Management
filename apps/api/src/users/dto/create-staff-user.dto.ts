import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { UserRole } from "@prisma/client";

const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

// SUPER_ADMIN is deliberately excluded — it is a platform-operator role
// that is never assignable through the tenant-facing API, closing off the
// most direct privilege-escalation path (a caller setting role in the
// request body).
const ASSIGNABLE_ROLES: UserRole[] = [
  "ORG_ADMIN",
  "HOTEL_MANAGER",
  "FRONT_DESK_AGENT",
  "HOUSEKEEPING_STAFF",
  "GUEST_PORTAL",
];

export class CreateStaffUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD_RE, {
    message: "password must include upper, lower, digit and symbol characters",
  })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  hotelId?: string;
}

export { ASSIGNABLE_ROLES };
