import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const ROOM_STATUSES = ["AVAILABLE", "OUT_OF_SERVICE", "MAINTENANCE"];

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  roomNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  @Type(() => Number)
  floor?: number;

  @IsOptional()
  @IsIn(ROOM_STATUSES)
  status?: "AVAILABLE" | "OUT_OF_SERVICE" | "MAINTENANCE";
}
