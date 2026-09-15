import { IsOptional, IsString, MaxLength } from "class-validator";

export class ListGuestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(254)
  search?: string;
}
