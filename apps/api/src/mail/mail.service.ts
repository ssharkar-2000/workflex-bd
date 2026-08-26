import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Locale } from '@workflex/shared';
import type { Env } from '../config/env.schema';
import type { MailProvider, MailResult } from './mail-provider.interface';
import {
  ConsoleMailProvider,
  FileMailProvider,
} from './providers/dev.providers';
import { ResendMailProvider } from './providers/resend.provider';
import { SmtpMailProvider } from './providers/smtp.provider';

const DEV_PROVIDERS = ['file', 'console'] as const;

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: MailProvider;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.provider = this.buildProvider();
  }

  onModuleInit(): void {
    if (this.isDevProvider) {
      this.logger.warn(
        `MAIL_PROVIDER=${this.provider.name} - emails are not delivered.`,
      );
    } else {
      this.logger.log(`Mail provider: ${this.provider.name} (live delivery)`);
    }
  }

  get isDevProvider(): boolean {
    return (DEV_PROVIDERS as readonly string[]).includes(this.provider.name);
  }

  private buildProvider(): MailProvider {
    switch (this.config.get('MAIL_PROVIDER', { infer: true })) {
      case 'console':
        return new ConsoleMailProvider();
      case 'smtp':
        return new SmtpMailProvider({
          host: this.config.get('SMTP_HOST', { infer: true }),
          port: this.config.get('SMTP_PORT', { infer: true }),
          secure: this.config.get('SMTP_SECURE', { infer: true }),
          user: this.config.get('SMTP_USER', { infer: true })!,
          pass: this.config.get('SMTP_PASS', { infer: true })!,
          from: this.config.get('MAIL_FROM', { infer: true }),
        });

      case 'resend':
        return new ResendMailProvider({
          apiKey: this.config.get('RESEND_API_KEY', { infer: true })!,
          from: this.config.get('MAIL_FROM', { infer: true }),
        });
      case 'file':
      default:
        return new FileMailProvider(
          this.config.get('MAIL_LOG_FILE', { infer: true }),
        );
    }
  }

  async sendEmailVerification(
    to: string,
    code: string,
    locale: Locale,
    toName?: string,
  ): Promise<MailResult> {
    const ttlMinutes = Math.round(
      this.config.get('OTP_TTL_SECONDS', { infer: true }) / 60,
    );

    const content =
      locale === 'bn'
        ? {
            subject: 'WorkFlex BD ইমেইল যাচাই কোড',
            text:
              `আপনার ইমেইল যাচাই কোড: ${code}\n\n` +
              `কোডটি ${ttlMinutes} মিনিট পর মেয়াদ শেষ হবে। কারও সাথে শেয়ার করবেন না।\n\n` +
              `আপনি যদি এটি না চেয়ে থাকেন, এই বার্তাটি উপেক্ষা করুন।`,
          }
        : {
            subject: 'Your WorkFlex BD email verification code',
            text:
              `Your email verification code is ${code}\n\n` +
              `It expires in ${ttlMinutes} minutes. Never share it with anyone.\n\n` +
              `If you did not request this, you can ignore this message.`,
          };

    try {
      return await this.provider.send({
        to,
        toName,
        expiryMinutes: ttlMinutes,
        ...content,
      });
    } catch (err) {
      this.logger.error(
        { err, provider: this.provider.name },
        'Email delivery failed',
      );
      throw err;
    }
  }
}
