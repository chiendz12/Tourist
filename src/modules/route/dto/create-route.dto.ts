import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RouteWaypointDto {
  @IsString()
  destinationId!: string;

  @Type(() => Number)
  @IsInt()
  order!: number;

  @IsOptional()
  @Type(() => Number)
  stayMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRouteDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteWaypointDto)
  waypoints!: RouteWaypointDto[];
}
