import { IsEnum } from 'class-validator';
import { HocPhanCode } from '@prisma/client';

export class MetricsQueryDto {
  @IsEnum(HocPhanCode)
  hocPhan!: HocPhanCode;
}
