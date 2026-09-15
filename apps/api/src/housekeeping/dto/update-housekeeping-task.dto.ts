import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

const HOUSEKEEPING_STATUSES = ["DIRTY", "IN_PROGRESS", "CLEAN", "INSPECTED", "OUT_OF_SERVICE"];

export class UpdateHousekeepingTaskDto {
  @IsOptional()
  @IsIn(HOUSEKEEPING_STATUSES)
  status?: "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED" | "OUT_OF_SERVICE";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
