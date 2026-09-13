import { IsEnum, IsOptional, IsString } from 'class-validator';
import { HocPhanCode } from '@prisma/client';

export class CreateHocPhanDto {
  @IsEnum(HocPhanCode)
  code!: HocPhanCode;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
