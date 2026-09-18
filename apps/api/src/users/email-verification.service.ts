import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateOtpCode } from '../common/otp-code.util';
import {
  ApiErrorCode,
  type EmailStatus,
  type Locale,
  type SetEmailResponse,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { MailService } from '../mail/mail.service';
import type { Env } from '../config/env.schema';

/**
 * Optional email verification.
 *
 * Deliberately parallel to the SMS flow but never a replacement for it: the
 * address is held in a pending record until confirmed, so a mistyped or
 * hostile change cannot displace an address the account already relies on,
 * and no verification level is granted by email alone.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private hash(code: string): string {
    return createHmac('sha256', this.config.get('OTP_PEPPER', { infer: true }))
      .update(code)
      .digest('hex');
  }

  async status(userId: string): Promise<EmailStatus> {
    const [user, pending] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.emailVerification.findFirst({
        where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      email: user.email,
      verified: user.emailVerifiedAt !== null,
      pendingEmail: pending?.email ?? null,
    };
  }

  async request(
    userId: string,
    email: string,
    locale: Locale,
  ): Promise<SetEmailResponse> {
    const adminDomain = this.config
      .get('ADMIN_EMAIL_DOMAIN', { infer: true })
      .toLowerCase();
    if (email.toLowerCase().endsWith(`@${adminDomain}`)) {
      throw new AppException(
        ApiErrorCode.EMAIL_RESERVED,
        'This email domain is reserved and cannot be used on a user account.',
        HttpStatus.FORBIDDEN,
      );
    }

    const ttl = this.config.get('OTP_TTL_SECONDS', { infer: true });
    const cooldown = this.config.get('OTP_RESEND_COOLDOWN_SECONDS', {
      infer: true,
    });

    const owner = await this.prisma.user.findUnique({ where: { email } });
    if (owner && owner.id !== userId) {
      throw new AppException(
        ApiErrorCode.EMAIL_IN_USE,
        'That email is already linked to another account.',
        HttpStatus.CONFLICT,
      );
    }

    const recent = await this.prisma.emailVerification.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (elapsed < cooldown) {
        const retryAfter = Math.ceil(cooldown - elapsed);
        throw new AppException(
          ApiErrorCode.EMAIL_COOLDOWN,
          `Please wait ${retryAfter}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
          { retryAfter },
        );
      }
    }

    const code = generateOtpCode();

    const [, created] = await this.prisma.$transaction([
      this.prisma.emailVerification.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.emailVerification.create({
        data: {
          userId,
          email,
          codeHash: this.hash(code),
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      }),
    ]);

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined;

      await this.mail.sendEmailVerification(email, code, locale, displayName);
    } catch {
      await this.prisma.emailVerification.update({
        where: { id: created.id },
        data: { consumedAt: new Date() },
      });
      throw new AppException(
        ApiErrorCode.EMAIL_DELIVERY_FAILED,
        'Could not send the email right now. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.log(`Email verification issued for user ${userId}`);

    return {
      email,
      expiresIn: ttl,
      resendAfter: cooldown,
      ...(this.mail.isDevProvider &&
      this.config.get('OTP_EXPOSE_DEV_CODE', { infer: true })
        ? { devCode: code }
        : {}),
    };
  }

  async verify(userId: string, code: string): Promise<EmailStatus> {
    const maxAttempts = this.config.get('OTP_MAX_ATTEMPTS', { infer: true });

    const record = await this.prisma.emailVerification.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        ApiErrorCode.EMAIL_CODE_EXPIRED,
        'No active code. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (record.attempts >= maxAttempts) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw new AppException(
        ApiErrorCode.EMAIL_CODE_INVALID,
        'Too many incorrect attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(this.hash(code), 'hex');
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const updated = await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppException(
        ApiErrorCode.EMAIL_CODE_INVALID,
        'Incorrect code',
        HttpStatus.BAD_REQUEST,
        { attemptsRemaining: Math.max(0, maxAttempts - updated.attempts) },
      );
    }

    // Re-check ownership at the moment of commit: someone else may have
    // claimed the address between request and verify.
    const owner = await this.prisma.user.findUnique({
      where: { email: record.email },
    });
    if (owner && owner.id !== userId) {
      throw new AppException(
        ApiErrorCode.EMAIL_IN_USE,
        'That email is already linked to another account.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { email: record.email, emailVerifiedAt: new Date() },
      }),
    ]);

    return { email: record.email, verified: true, pendingEmail: null };
  }

  /** Unlinking is allowed precisely because email is never required. */
  async remove(userId: string): Promise<EmailStatus> {
    await this.prisma.$transaction([
      this.prisma.emailVerification.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { email: null, emailVerifiedAt: null },
      }),
    ]);

    return { email: null, verified: false, pendingEmail: null };
  }
}
