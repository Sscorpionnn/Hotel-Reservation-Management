import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

export class CreateRatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsInt()
  @Min(0)
  @Max(100_000_00)
  @Type(() => Number)
  priceCents!: number;

  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  @Type(() => Number)
  minStayNights: number = 1;

  @IsOptional()
  @IsBoolean()
  isRefundable: boolean = true;
}
