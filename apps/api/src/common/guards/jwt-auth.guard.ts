import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { accessTokenPayloadSchema } from '@workflex/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestWithUser } from '../decorators/current-user.decorator';
import { AppException } from '../exceptions/app.exception';
import type { Env } from '../../config/env.schema';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw AppException.unauthorized('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      const raw = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      const payload = accessTokenPayloadSchema.parse(raw);

      req.user = {
        userId: payload.sub,
        verificationLevel: payload.vl,
        isAdmin: payload.adm,
      };
      return true;
    } catch {
      // Expired vs malformed are not distinguished on purpose — the client
      // reacts identically (attempt refresh, then log out).
      throw AppException.unauthorized('Invalid or expired access token');
    }
  }
}
