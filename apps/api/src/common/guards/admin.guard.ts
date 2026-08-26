import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../decorators/current-user.decorator';
import { AppException } from '../exceptions/app.exception';

/**
 * Runs after JwtAuthGuard, so req.user is already populated and verified.
 * Reads the flag from the token rather than the database: admin status changes
 * rarely, and the token is short-lived enough that a revoked admin loses
 * access within the access-token TTL.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();

    if (!req.user?.isAdmin) {
      // Deliberately "Not found", not "Forbidden" — an admin-only surface
      // should not confirm its own existence to a normal user.
      throw AppException.notFound('Not found');
    }
    return true;
  }
}
