import { Module } from '@nestjs/common';
import { PoiController } from './poi.controller';
import { PoiService } from './poi.service';

@Module({
  controllers: [PoiController],
  providers: [PoiService],
})
export class PoiModule {}
