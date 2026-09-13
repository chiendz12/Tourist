import { IsEnum, IsOptional } from 'class-validator';
import { ModerationStatus } from '@prisma/client';

export enum ModerationKind {
  RATING = 'RATING',
  COMMENT = 'COMMENT',
}

export class QueryModerationDto {
  @IsOptional()
  @IsEnum(ModerationKind)
  kind?: ModerationKind;

  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;
}
