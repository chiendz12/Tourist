import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

/** Public self-registration is limited to students and lecturers. */
export const REGISTERABLE_ROLES = [Role.STUDENT, Role.LECTURER] as const;

export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(3) username!: string;
  @ApiProperty() @IsString() @MinLength(6) password!: string;
  @ApiProperty() @IsString() fullName!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ enum: REGISTERABLE_ROLES, default: Role.STUDENT })
  @IsOptional()
  @IsIn(REGISTERABLE_ROLES)
  role?: (typeof REGISTERABLE_ROLES)[number];
}
