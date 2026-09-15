import { IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

export class CreateHotelDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(SLUG_RE)
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MaxLength(60)
  timezone!: string;

  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;

  @IsString()
  @MaxLength(200)
  addressLine!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(100)
  country!: string;
}
