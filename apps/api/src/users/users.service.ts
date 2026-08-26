import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  DEFAULT_LOCALE,
  type AuthUser,
  type Locale,
  type ProfileKind,
  type RecruiterKind,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw AppException.notFound('User not found');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  /**
   * Creates the account on first successful OTP verification. There is no
   * separate "sign up" — in this market asking for a registration form before
   * a phone check just loses users.
   */
  async createFromPhone(phone: string): Promise<User> {
    return this.prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        verificationLevel: 0,
      },
    });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async setLocale(id: string, locale: Locale): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { locale } });
  }

  async markPhoneVerified(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  /**
   * Public shape of a user.
   *
   * `profiles` and `recruiterKind` are placeholders until the profile module
   * lands in Phase 1 — the fields exist now so the mobile role switcher can be
   * built against a stable contract rather than being retrofitted later.
   *
   * Async only because of `hasPhoto`, which needs one indexed lookup. Doing it
   * here rather than letting each caller pass a flag means sign-in and /me
   * cannot disagree about whether the account has a photo.
   */
  async toAuthUser(user: User): Promise<AuthUser> {
    const profiles: ProfileKind[] = [];
    const recruiterKind: RecruiterKind | null = null;

    const selfie = await this.prisma.document.findUnique({
      where: { userId_kind: { userId: user.id, kind: 'SELFIE' } },
      select: { id: true },
    });

    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      hasPhoto: selfie !== null,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      locale: (user.locale === 'en' ? 'en' : DEFAULT_LOCALE) as Locale,
      status: user.status,
      verificationLevel: user.verificationLevel as 0 | 1 | 2,
      isAdmin: user.isAdmin,
      profiles,
      recruiterKind,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
