import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTaskDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsBooleanString()
  dueOnly?: string;
}
