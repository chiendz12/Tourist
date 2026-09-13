import { Module } from '@nestjs/common';
import { TourModule } from '../tour/tour.module';
import { GradingController } from './grading.controller';
import { GradingService } from './grading.service';

@Module({
  // TourModule exports PricingService so the HP3 indicators reuse the pricing rules.
  imports: [TourModule],
  controllers: [GradingController],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
