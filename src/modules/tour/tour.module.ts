import { Module } from '@nestjs/common';
import { ProvinceModule } from '../province/province.module';
import { PricingService } from './pricing.service';
import { TourCostController } from './tour-cost.controller';
import { TourCostService } from './tour-cost.service';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';

@Module({
  imports: [ProvinceModule],
  controllers: [TourController, TourCostController],
  providers: [TourService, TourCostService, PricingService],
  exports: [TourService, PricingService],
})
export class TourModule {}
