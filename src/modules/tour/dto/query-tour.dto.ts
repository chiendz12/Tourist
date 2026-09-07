import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AgeGroup, Season, TravelStyle } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Lets a visitor find a tour along the same axes HP2 designs them on. */
export class QueryTourDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @IsOptional()
  @IsEnum(TravelStyle)
  travelStyle?: TravelStyle;

  @IsOptional()
  @IsEnum(Season)
  season?: Season;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
