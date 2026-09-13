import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import databaseConfig from './database.config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig],
      validate: validateEnv,
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
