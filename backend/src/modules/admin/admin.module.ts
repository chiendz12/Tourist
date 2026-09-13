import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SystemLockGuard } from '../../common/guards/system-lock.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemSettingService } from './system-setting.service';

// Global so the app-wide SystemLockGuard can resolve SystemSettingService.
@Global()
@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    SystemSettingService,
    { provide: APP_GUARD, useClass: SystemLockGuard },
  ],
  exports: [SystemSettingService],
})
export class AdminModule {}
