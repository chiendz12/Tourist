import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsString()
  hocPhanId!: string;

  @IsOptional()
  @IsString()
  lecturerId?: string;

  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
