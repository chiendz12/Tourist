import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecordGradeDto {
  @IsString()
  studentId!: string;

  @IsString()
  hocPhanId!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  /** Vietnamese 10-point scale. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
