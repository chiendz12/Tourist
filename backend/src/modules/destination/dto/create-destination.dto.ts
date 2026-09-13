import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { DestinationCategory } from '@prisma/client';

export class CreateDestinationDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DestinationCategory)
  category?: DestinationCategory;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ticketPrice?: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  lat!: number;
}
