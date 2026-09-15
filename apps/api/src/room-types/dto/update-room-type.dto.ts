import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateRoomTypeDto } from "./create-room-type.dto";

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
