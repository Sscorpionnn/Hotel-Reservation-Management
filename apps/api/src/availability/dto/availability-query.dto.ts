import { IsDateString } from "class-validator";

export class AvailabilityQueryDto {
  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;
}
