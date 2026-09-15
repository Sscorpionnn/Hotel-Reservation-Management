import { IsIn, IsOptional } from "class-validator";

const ROOM_STATUSES = ["AVAILABLE", "OUT_OF_SERVICE", "MAINTENANCE"];

export class ListRoomsQueryDto {
  @IsOptional()
  @IsIn(ROOM_STATUSES)
  status?: "AVAILABLE" | "OUT_OF_SERVICE" | "MAINTENANCE";
}
