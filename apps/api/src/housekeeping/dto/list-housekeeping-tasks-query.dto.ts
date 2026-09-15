import { IsIn, IsOptional } from "class-validator";

const HOUSEKEEPING_STATUSES = ["DIRTY", "IN_PROGRESS", "CLEAN", "INSPECTED", "OUT_OF_SERVICE"];

export class ListHousekeepingTasksQueryDto {
  @IsOptional()
  @IsIn(HOUSEKEEPING_STATUSES)
  status?: "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED" | "OUT_OF_SERVICE";
}
