import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { PoiService } from './poi.service';
import { QueryPoiDto } from './dto/query-poi.dto';

@Public()
@ApiTags('poi')
@Controller('poi')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  /** Public endpoint: hotels and restaurants within a bbox, sourced from OpenStreetMap. */
  @Get('hotels-food')
  hotelsFood(@Query() query: QueryPoiDto) {
    return this.poiService.fetchHotelsAndFood(
      query.south,
      query.west,
      query.north,
      query.east,
      query.types,
    );
  }
}
