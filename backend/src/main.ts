import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FriendlyExceptionFilter } from './common/friendly-exception.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new SerializeInterceptor());
  // Item 14: nothing technical reaches the app — see FriendlyExceptionFilter.
  app.useGlobalFilters(new FriendlyExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`WorkFlex BD API on http://0.0.0.0:${port}/api`);
}
bootstrap();
