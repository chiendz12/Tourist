import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProvinceGuard } from '../../common/guards/province.guard';
import { HocPhanGuard } from '../../common/guards/hocphan.guard';
import { ProvinceModule } from '../province/province.module';

@Module({
  // ProvinceModule supplies ProvinceAccessService to the globally-registered ProvinceGuard.
  imports: [PassportModule, JwtModule.register({}), ProvinceModule],
  providers: [
    AuthService,
    JwtStrategy,
    // Apply auth guards globally; Public() decorator opts out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ProvinceGuard },
    { provide: APP_GUARD, useClass: HocPhanGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
