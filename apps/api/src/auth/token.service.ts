import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import {
  ApiErrorCode,
  type AccessTokenPayload,
  type AuthTokens,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';

export interface SessionContext {
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Access + refresh token issuance.
 *
 * Access tokens are short-lived JWTs (stateless, no DB hit per request).
 * Refresh tokens are opaque random strings stored only as SHA-256 hashes and
 * rotated on every use. Rotation gives us theft detection: if a token that has
 * already been rotated is presented again, the only explanations are a stolen
 * copy or a replay, so the entire token family is revoked and the user is
 * forced to log in again.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private hashToken(token: string): string {
    // Plain SHA-256 is right here (unlike passwords): the token is 256 bits of
    // CSPRNG output, so there is no dictionary to attack and no need to slow
    // the hash down on a hot path.
    return createHash('sha256').update(token).digest('hex');
  }

  private accessTtlSeconds(): number {
    const ttl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
    return value * multiplier;
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      vl: user.verificationLevel as 0 | 1 | 2,
      adm: user.isAdmin,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
  }

  private async persistRefreshToken(
    userId: string,
    familyId: string,
    ctx: SessionContext,
  ): Promise<{ token: string; id: string }> {
    const token = randomBytes(32).toString('base64url');
    const days = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hashToken(token),
        deviceId: ctx.deviceId ?? null,
        userAgent: ctx.userAgent?.slice(0, 512) ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(Date.now() + days * 86_400_000),
      },
    });

    return { token, id: record.id };
  }

  /** New login: starts a fresh token family. */
  async issuePair(user: User, ctx: SessionContext): Promise<AuthTokens> {
    const [accessToken, refresh] = await Promise.all([
      this.signAccessToken(user),
      this.persistRefreshToken(user.id, randomUUID(), ctx),
    ]);

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  /** Exchange a refresh token for a new pair, rotating within the family. */
  async rotate(refreshToken: string, ctx: SessionContext): Promise<AuthTokens> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: true },
    });

    if (!existing) {
      throw new AppException(
        ApiErrorCode.REFRESH_TOKEN_INVALID,
        'Session expired. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (existing.revokedAt) {
      // Already-rotated token replayed: assume theft and drop the family.
      this.logger.warn(
        { userId: existing.userId, familyId: existing.familyId },
        'Refresh token reuse detected — revoking token family',
      );
      await this.revokeFamily(existing.familyId);
      throw new AppException(
        ApiErrorCode.REFRESH_TOKEN_REUSED,
        'Session was invalidated for security reasons. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        ApiErrorCode.REFRESH_TOKEN_INVALID,
        'Session expired. Please sign in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (existing.user.status !== 'ACTIVE') {
      throw new AppException(
        ApiErrorCode.ACCOUNT_SUSPENDED,
        'This account is not active.',
        HttpStatus.FORBIDDEN,
      );
    }

    const next = await this.persistRefreshToken(
      existing.userId,
      existing.familyId,
      { ...ctx, deviceId: ctx.deviceId ?? existing.deviceId ?? undefined },
    );

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenId: next.id },
    });

    return {
      accessToken: await this.signAccessToken(existing.user),
      refreshToken: next.token,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** "Sign out of all devices". */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
