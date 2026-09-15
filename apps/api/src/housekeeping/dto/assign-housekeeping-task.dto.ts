import { IsUUID } from "class-validator";

export class AssignHousekeepingTaskDto {
  @IsUUID()
  assignedToId!: string;
}
