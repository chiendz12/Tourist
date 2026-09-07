import { Module } from '@nestjs/common';
import { HocPhanController } from './hocphan.controller';
import { HocPhanService } from './hocphan.service';

@Module({
  controllers: [HocPhanController],
  providers: [HocPhanService],
  exports: [HocPhanService],
})
export class HocPhanModule {}
