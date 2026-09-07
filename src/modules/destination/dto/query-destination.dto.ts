import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalStatus, DestinationCategory } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryDestinationDto extends PaginationDto {
  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsEnum(DestinationCategory)
  category?: DestinationCategory;

  /** Free-text search over name + address. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Type(() => String)
  q?: string;

  /** Only honoured on endpoints that already scope the caller (e.g. /mine). */
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}
