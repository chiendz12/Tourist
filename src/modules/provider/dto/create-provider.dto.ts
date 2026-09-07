import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { SupplierType } from '@prisma/client';

export class CreateProviderDto {
  @IsString()
  name!: string;

  @IsEnum(SupplierType)
  type!: SupplierType;

  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
