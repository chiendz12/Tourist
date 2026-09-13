import { IsString } from 'class-validator';

export class AssignProvinceDto {
  @IsString()
  provinceId!: string;
}
