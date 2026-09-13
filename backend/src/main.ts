import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);
  const prefix = config.get<string>('app.apiPrefix', 'api');
  const corsOrigin = config.get<string>('app.corsOrigin', '*');
  const nodeEnv = config.get<string>('app.nodeEnv', 'development');

  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use(morgan('combined'));
  const corsOrigins = corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tourist Map API')
      .setDescription('Backend API for Tourist Map - Public + Training platforms')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  Logger.log(`🚀 API running at http://localhost:${port}/${prefix}`, 'Bootstrap');
  Logger.log(`📚 Swagger at  http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
