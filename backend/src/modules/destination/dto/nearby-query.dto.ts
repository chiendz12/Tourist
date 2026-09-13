import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DestinationCategory } from '@prisma/client';

export class NearbyQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  /** Search radius in metres (default 5 km, max 200 km). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200_000)
  radius = 5_000;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @IsOptional()
  @IsEnum(DestinationCategory)
  category?: DestinationCategory;

  @IsOptional()
  @IsString()
  provinceId?: string;
}
