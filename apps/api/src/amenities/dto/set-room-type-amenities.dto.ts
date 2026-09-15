import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

export class SetRoomTypeAmenitiesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(4, { each: true })
  amenityIds!: string[];
}
