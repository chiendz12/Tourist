import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalAction } from '@prisma/client';

export class ReviewApprovalDto {
  @IsEnum(ApprovalAction)
  action!: ApprovalAction;

  @IsOptional()
  @IsString()
  comment?: string;
}
