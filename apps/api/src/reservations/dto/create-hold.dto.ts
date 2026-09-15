import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class CreateHoldDto {
  @IsUUID()
  hotelId!: string;

  @IsUUID()
  roomTypeId!: string;

  @IsUUID()
  guestId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  @IsOptional()
  roomsRequested: number = 1;

  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  @IsOptional()
  adults: number = 1;

  @IsInt()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  @IsOptional()
  children: number = 0;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  // Client-generated key so a retried request (double-click, network
  // retry, mobile app resubmission) never creates a second reservation.
  @IsString()
  @IsUUID(4)
  idempotencyKey!: string;
}
