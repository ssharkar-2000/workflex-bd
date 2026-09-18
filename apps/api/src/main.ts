import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const isDev = config.get('NODE_ENV', { infer: true }) === 'development';

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // The mobile app is not a browser origin, so CORS matters only for the
  // future admin panel and for Swagger during development.
  app.enableCors({
    origin: isDev ? true : ['https://admin.workflex.com.bd'],
    credentials: true,
  });

  if (isDev) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('WorkFlex BD API')
        .setDescription('Workforce marketplace for Bangladesh')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  // 0.0.0.0, not localhost: the milestone for this phase is logging in from a
  // physical handset over the LAN, which cannot reach a loopback-bound server.
  await app.listen(port, '0.0.0.0');

  const logger = app.get(PinoLogger);
  logger.log(`API listening on http://0.0.0.0:${port}/api/v1`);
  if (isDev) logger.log(`Swagger UI at http://localhost:${port}/api/docs`);
}

void bootstrap();
