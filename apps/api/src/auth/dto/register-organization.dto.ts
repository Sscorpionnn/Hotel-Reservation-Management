import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organizationName!: string;

  @IsString()
  @Matches(SLUG_RE, { message: "slug must be lowercase, alphanumeric, hyphen-separated" })
  @MaxLength(60)
  organizationSlug!: string;

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
}
