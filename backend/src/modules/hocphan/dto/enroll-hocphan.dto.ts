import { IsString } from 'class-validator';

export class EnrollHocPhanDto {
  @IsString()
  userId!: string;

  @IsString()
  hocPhanId!: string;
}
