import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

export class CreateRoomTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  capacityAdults!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  capacityChildren!: number;

  @IsInt()
  @Min(0)
  @Max(100_000_00)
  @Type(() => Number)
  basePriceCents!: number;

  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;
}
