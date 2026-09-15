import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"];

export class CreatePromotionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsIn(DISCOUNT_TYPES)
  discountType!: "PERCENTAGE" | "FIXED_AMOUNT";

  // Upper bound of 100_000_00 covers FIXED_AMOUNT (cents); PERCENTAGE is
  // additionally capped at 100 in PromotionsService, where the discountType
  // is available to branch on.
  @IsInt()
  @IsPositive()
  @Max(100_000_00)
  @Type(() => Number)
  discountValue!: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxRedemptions?: number;

  @IsOptional()
  @IsUUID()
  hotelId?: string;
}
