import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DestinationCategory } from '@prisma/client';

/** Viewport query for the map: south-west + north-east corner. */
export class BboxQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  minLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  minLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  maxLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  maxLat!: number;

  /** Cap on markers returned so a zoomed-out viewport cannot pull the whole table. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 500;

  @IsOptional()
  @IsEnum(DestinationCategory)
  category?: DestinationCategory;

  @IsOptional()
  @IsString()
  provinceId?: string;
}
