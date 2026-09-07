import { Module } from '@nestjs/common';
import { ProvinceAccessService } from './province-access.service';
import { ProvinceController } from './province.controller';
import { ProvinceService } from './province.service';

@Module({
  controllers: [ProvinceController],
  providers: [ProvinceService, ProvinceAccessService],
  exports: [ProvinceService, ProvinceAccessService],
})
export class ProvinceModule {}
