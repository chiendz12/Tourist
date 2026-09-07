import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, Max, Min, ValidateNested } from 'class-validator';

export class DirectionPointDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}

export class DirectionsDto {
  /** Mapbox Directions accepts between 2 and 25 coordinates. */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => DirectionPointDto)
  coordinates!: DirectionPointDto[];
}
