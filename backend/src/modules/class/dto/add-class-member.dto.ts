import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AddClassMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;

  @IsOptional()
  @IsString()
  groupId?: string;
}
