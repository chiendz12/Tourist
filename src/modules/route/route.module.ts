import { Module } from '@nestjs/common';
import { MapboxModule } from '../mapbox/mapbox.module';
import { ProvinceModule } from '../province/province.module';
import { RouteController } from './route.controller';
import { RouteService } from './route.service';

@Module({
  imports: [MapboxModule, ProvinceModule],
  controllers: [RouteController],
  providers: [RouteService],
  exports: [RouteService],
})
export class RouteModule {}
