import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProvinceModule } from './modules/province/province.module';
import { HocPhanModule } from './modules/hocphan/hocphan.module';
import { ClassModule } from './modules/class/class.module';
import { DestinationModule } from './modules/destination/destination.module';
import { RouteModule } from './modules/route/route.module';
import { TourModule } from './modules/tour/tour.module';
import { ProviderModule } from './modules/provider/provider.module';
import { RatingModule } from './modules/rating/rating.module';
import { CommentModule } from './modules/comment/comment.module';
import { ItineraryModule } from './modules/itinerary/itinerary.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { MapboxModule } from './modules/mapbox/mapbox.module';
import { PoiModule } from './modules/poi/poi.module';
import { GradingModule } from './modules/grading/grading.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { TaskModule } from './modules/task/task.module';
import { FavoriteModule } from './modules/favorite/favorite.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
          limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ProvinceModule,
    HocPhanModule,
    ClassModule,
    DestinationModule,
    RouteModule,
    TourModule,
    ProviderModule,
    RatingModule,
    CommentModule,
    ItineraryModule,
    ApprovalModule,
    MapboxModule,
    PoiModule,
    GradingModule,
    NotificationModule,
    AdminModule,
    TaskModule,
    FavoriteModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
