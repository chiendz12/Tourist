import { Module } from '@nestjs/common';
import { ProvinceModule } from '../province/province.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [ProvinceModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
