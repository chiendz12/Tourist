import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateItineraryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  tourId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
