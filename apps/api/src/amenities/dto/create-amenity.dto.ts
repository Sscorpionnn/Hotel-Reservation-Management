import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateAmenityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}
