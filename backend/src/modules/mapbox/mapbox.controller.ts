import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public, Roles } from '../../common/decorators';
import { DirectionsDto } from './dto/directions.dto';
import { MapboxService } from './mapbox.service';

@Public()
@ApiTags('mapbox')
@Controller('mapbox')
export class MapboxController {
  constructor(private readonly mapboxService: MapboxService) {}

  /**
   * Directions is the expensive call on a server-side token, so unlike the rest of
   * the proxy it requires a signed-in user.
   */
  @ApiBearerAuth()
  @Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Post('directions')
  directions(@Body() dto: DirectionsDto) {
    return this.mapboxService.directions(
      dto.coordinates.map((point) => [point.lng, point.lat] as [number, number]),
    );
  }

  @Get('geocode')
  geocode(@Query('q') query: string) {
    return this.mapboxService.geocode(query);
  }

  @Get('reverse')
  reverseGeocode(@Query('lng') lng: number, @Query('lat') lat: number) {
    return this.mapboxService.reverseGeocode(Number(lng), Number(lat));
  }

  /**
   * OpenStreetMap place search proxied server-side: browsers get blocked or
   * throttled calling Nominatim directly (missing UA, 1 req/s policy), so
   * the frontend uses this instead of fetch-to-OSM.
   */
  @Get('search')
  search(@Query('q') query: string, @Query('viewbox') viewbox?: string) {
    return this.mapboxService.searchPlaces(query?.trim() ?? '', viewbox);
  }

  @Get('static-map')
  staticMap(@Query('lng') lng: number, @Query('lat') lat: number) {
    return { url: this.mapboxService.staticMapUrl(Number(lng), Number(lat)) };
  }
}
