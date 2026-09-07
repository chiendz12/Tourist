import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SupplierType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryProviderDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SupplierType)
  type?: SupplierType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  provinceId?: string;
}
