import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CostCategory } from '@prisma/client';

export class CreateTourCostDto {
  @IsEnum(CostCategory)
  category!: CostCategory;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  /** Units of this line: nights, meals, tickets… */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  /** false = a single charge for the whole group (e.g. one coach). */
  @IsOptional()
  @IsBoolean()
  isPerPerson?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
