import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateRoomDto {
  @IsUUID()
  roomTypeId!: string;

  @IsString()
  @MaxLength(20)
  roomNumber!: string;

  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(200)
  @Type(() => Number)
  floor?: number;
}
