import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from './env.schema';

/** Typed ConfigService — `config.get('PORT')` is `number`, not `string | undefined`. */
export type TypedConfigService = ConfigService<Env, true>;

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Root .env first so the whole monorepo shares one file in dev.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
