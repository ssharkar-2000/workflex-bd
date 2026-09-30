import 'reflect-metadata';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

/**
 * The chat socket answers the same browser origins as the HTTP API. Phones
 * send no origin, so this only matters for the app on the web.
 */
class ChatIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly cors: ServerOptions['cors'],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: this.cors } as ServerOptions);
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const isDev = config.get('NODE_ENV', { infer: true }) === 'development';

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // The phone app is not a browser origin, so CORS matters for the two web
  // builds — the console and the app on the web — and for Swagger.
  //
  // In production the allowed origins come from APP_WEB_ORIGINS, comma
  // separated, because where those builds are served from is a deployment
  // decision rather than something to hard-code here. An empty list means no
  // browser may call this API, which is the safe end to fail towards.
  const webOrigins = (config.get('APP_WEB_ORIGINS', { infer: true }) ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: isDev ? true : webOrigins,
    credentials: true,
  });
  app.useWebSocketAdapter(
    new ChatIoAdapter(app, { origin: isDev ? true : webOrigins, credentials: true }),
  );

  if (!isDev && webOrigins.length === 0) {
    new Logger('Bootstrap').warn(
      'APP_WEB_ORIGINS is empty: no browser origin may call this API. ' +
        'Set it to the console and web app addresses.',
    );
  }

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
