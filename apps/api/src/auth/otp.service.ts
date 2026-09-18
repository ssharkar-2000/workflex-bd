import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateOtpCode } from '../common/otp-code.util';
import type { OtpPurpose } from '@prisma/client';
import { ApiErrorCode, maskPhone } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { SmsService } from '../sms/sms.service';
import type { Env } from '../config/env.schema';

export interface IssuedOtp {
  expiresIn: number;
  resendAfter: number;
  devCode?: string;
}

/**
 * Issue and verify one-time codes.
 *
 * Codes are stored as HMAC-SHA256(code, OTP_PEPPER), never in plaintext: a
 * six-digit code is only 10^6 values, so a leaked table of plaintext codes
 * would be an account-takeover kit. The pepper lives in the environment
 * rather than the database so a SQL-only leak is not enough to forge one.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private hash(code: string): string {
    return createHmac(
      'sha256',
      this.config.get('OTP_PEPPER', { infer: true }),
    )
      .update(code)
      .digest('hex');
  }

  private generateCode(): string {
    return generateOtpCode();
  }

  async issue(phone: string, purpose: OtpPurpose): Promise<IssuedOtp> {
    const ttl = this.config.get('OTP_TTL_SECONDS', { infer: true });
    const cooldown = this.config.get('OTP_RESEND_COOLDOWN_SECONDS', {
      infer: true,
    });

    // Cooldown protects both the user's inbox and our SMS bill — each send
    // costs money, so "resend" spam is a real cost, not just an annoyance.
    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (elapsed < cooldown) {
        const retryAfter = Math.ceil(cooldown - elapsed);
        throw new AppException(
          ApiErrorCode.OTP_COOLDOWN,
          `Please wait ${retryAfter}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
          { retryAfter },
        );
      }
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Supersede outstanding codes so only the newest one can be used.
    const [, created] = await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { phone, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({
        data: { phone, purpose, codeHash: this.hash(code), expiresAt },
      }),
    ]);

    try {
      await this.sms.sendOtp(phone, code);
    } catch {
      // Burn the code we just minted. Otherwise a gateway outage would leave
      // the user in a resend cooldown waiting for a message that never comes.
      await this.prisma.otpCode.update({
        where: { id: created.id },
        data: { consumedAt: new Date() },
      });
      throw new AppException(
        ApiErrorCode.SMS_DELIVERY_FAILED,
        'Could not send the code right now. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.log(`OTP issued for ${maskPhone(phone)} (${purpose})`);

    // Both conditions must hold: a real gateway must not be configured, and
    // the operator must have explicitly opted in. Returning a live login code
    // to the caller defeats verification entirely, so it is never the default.
    const exposeCode =
      this.sms.isDevProvider &&
      this.config.get('OTP_EXPOSE_DEV_CODE', { infer: true });

    return {
      expiresIn: ttl,
      resendAfter: cooldown,
      ...(exposeCode ? { devCode: code } : {}),
    };
  }

  /** Consumes the code on success. Throws a coded AppException otherwise. */
  async verify(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    const maxAttempts = this.config.get('OTP_MAX_ATTEMPTS', { infer: true });

    const record = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new AppException(
        ApiErrorCode.OTP_EXPIRED,
        'No active code. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        ApiErrorCode.OTP_EXPIRED,
        'This code has expired. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (record.attempts >= maxAttempts) {
      // Burn the code so brute force cannot continue against it.
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw new AppException(
        ApiErrorCode.OTP_TOO_MANY_ATTEMPTS,
        'Too many incorrect attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(this.hash(code), 'hex');
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const updated = await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppException(
        ApiErrorCode.OTP_INVALID,
        'Incorrect code',
        HttpStatus.BAD_REQUEST,
        { attemptsRemaining: Math.max(0, maxAttempts - updated.attempts) },
      );
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  /** Housekeeping for a scheduled job once BullMQ lands. */
  async purgeExpired(olderThan = new Date()): Promise<number> {
    const { count } = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: olderThan } },
    });
    return count;
  }
}
