import { IsEnum, IsString } from 'class-validator';
import { EntityType } from '@prisma/client';

export class SubmitApprovalDto {
  @IsEnum(EntityType)
  entityType!: EntityType;

  @IsString()
  entityId!: string;
}
