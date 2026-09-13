import { IsBooleanString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApprovalStatus, EntityType, HocPhanCode } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryApprovalDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  /** "true" narrows the list to items sitting at the caller's own review level. */
  @IsOptional()
  @IsBooleanString()
  pendingOnly?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @IsEnum(HocPhanCode)
  hocPhan?: HocPhanCode;
}
