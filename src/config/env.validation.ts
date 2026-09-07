import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString() DATABASE_URL!: string;
  @IsString() JWT_SECRET!: string;
  @IsString() JWT_REFRESH_SECRET!: string;
  @IsOptional() @IsString() NODE_ENV?: string;
  @IsOptional() @IsString() CORS_ORIGIN?: string;
  @IsOptional() @IsString() MAPBOX_TOKEN?: string;
  @IsOptional() @IsInt() PORT?: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  if (validated.NODE_ENV === 'production') {
    const weakSecret = (secret: string) => secret.length < 32 || /replace-me|dev-/i.test(secret);
    if (weakSecret(validated.JWT_SECRET) || weakSecret(validated.JWT_REFRESH_SECRET)) {
      throw new Error('Production JWT secrets must be at least 32 characters and must not use development defaults');
    }
    if (!validated.CORS_ORIGIN || validated.CORS_ORIGIN.trim() === '*') {
      throw new Error('Production CORS_ORIGIN must explicitly list trusted origins');
    }
  }
  return validated;
}
