import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** What JwtAuthGuard attaches to the request after verifying the access token. */
export interface RequestUser {
  userId: string;
  verificationLevel: 0 | 1 | 2;
  isAdmin: boolean;
}

export type RequestWithUser = Request & { user?: RequestUser };

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
