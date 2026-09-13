import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  /** Omit to sign out of every device. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
