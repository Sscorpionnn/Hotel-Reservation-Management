import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateHotelDto } from "./create-hotel.dto";

export class UpdateHotelDto extends PartialType(CreateHotelDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
