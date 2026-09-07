import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SystemLockDto {
  @IsBoolean()
  locked!: boolean;

  /** Shown to users who hit a write while the system is locked. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}
