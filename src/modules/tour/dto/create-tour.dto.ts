import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AgeGroup, Season, TravelStyle } from '@prisma/client';

export class CreateTourDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  routeId?: string;

  /** "thời gian" axis of the HP2 design brief. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  /** Group size the price is quoted for (HP3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paxCount?: number;

  // HP2 — "thiết kế tour theo: độ tuổi, hành vi, ... mùa"
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AgeGroup, { each: true })
  targetAgeGroups?: AgeGroup[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(TravelStyle, { each: true })
  travelStyles?: TravelStyle[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Season, { each: true })
  seasons?: Season[];
}
