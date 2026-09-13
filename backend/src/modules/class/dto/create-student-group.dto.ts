import { IsString } from 'class-validator';

export class CreateStudentGroupDto {
  @IsString()
  name!: string;
}
