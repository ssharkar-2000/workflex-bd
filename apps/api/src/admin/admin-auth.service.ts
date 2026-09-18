import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiErrorCode, type AdminAuthTokens } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PasswordService } from '../users/password.service';
import type { Env } from '../config/env.schema';

/** A real scrypt hash of a random string — spent even when no account exists. */
const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

/**
 * Admin sign-in: email + password against the Admin table, never phone.
 *
 * Deliberately no refresh token. Admin accounts are few and used for review
 * work, not left open on a handset for weeks — an 8h access token that
 * expires into a re-login is a simpler, smaller surface than wiring a second
 * refresh-token family (RefreshToken.userId is a real FK to User, so Admin
 * sessions cannot use that table without either weakening the constraint or
 * duplicating it).
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly passwords: PasswordService,
  ) {}

  async login(email: string, password: string): Promise<AdminAuthTokens> {
    const normalized = email.trim().toLowerCase();
    const admin = await this.prisma.admin.findUnique({
      where: { email: normalized },
    });

    if (!admin) {
      // Spend the hashing time anyway so a missing account is not
      // detectable from response timing.
      await this.passwords.verify(password, DUMMY_HASH);
      throw this.invalidCredentials();
    }

    const matches = await this.passwords.verify(password, admin.passwordHash);
    if (!matches) throw this.invalidCredentials();

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, vl: 2 as const, adm: true },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('ADMIN_JWT_TTL', { infer: true }),
      },
    );

    this.logger.log(`Admin sign-in: ${normalized}`);

    return {
      accessToken,
      expiresIn: this.ttlSeconds(),
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  private ttlSeconds(): number {
    const ttl = this.config.get('ADMIN_JWT_TTL', { infer: true });
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 28_800;
    const value = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
    return value * multiplier;
  }

  private invalidCredentials(): AppException {
    return new AppException(
      ApiErrorCode.INVALID_CREDENTIALS,
      'Incorrect email or password.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
