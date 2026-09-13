import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export const POI_TYPE_OPTIONS = ['hotel', 'restaurant'] as const;
export type PoiType = (typeof POI_TYPE_OPTIONS)[number];

export class QueryPoiDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsEnum(POI_TYPE_OPTIONS, { each: true })
  types: PoiType[] = ['hotel', 'restaurant'];

  @IsNumber()
  @Min(-90)
  @Max(90)
  south!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  west!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  north!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  east!: number;
}
