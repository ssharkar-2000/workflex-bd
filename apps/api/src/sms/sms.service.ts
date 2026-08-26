import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskPhone } from '@workflex/shared';
import type { Env } from '../config/env.schema';
import type { SmsProvider, SmsResult } from './sms-provider.interface';
import { DevOutbox, type DevSmsRecord } from './dev-outbox';
import { ConsoleSmsProvider } from './providers/console.provider';
import { FileSmsProvider } from './providers/file.provider';
import { BulkSmsBdProvider } from './providers/bulksmsbd.provider';
import { TwilioProvider } from './providers/twilio.provider';

/** Providers that do not actually deliver anything. */
const DEV_PROVIDERS = ['console', 'file'] as const;

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private readonly outbox = new DevOutbox();
  private readonly provider: SmsProvider;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.provider = this.buildProvider();
  }

  onModuleInit(): void {
    if (this.provider.name === 'file') {
      this.logger.warn(
        `SMS_PROVIDER=file - codes are written to ` +
          `${this.config.get('SMS_LOG_FILE', { infer: true })}, not delivered.`,
      );
    } else if (this.provider.name === 'console') {
      this.logger.warn(
        'SMS_PROVIDER=console - codes are printed to this log, not delivered.',
      );
    } else {
      this.logger.log(`SMS provider: ${this.provider.name} (live delivery)`);
    }
  }

  /**
   * True when codes are not actually delivered. The OTP endpoint uses this to
   * decide whether it may return the code in its response — something that
   * must never happen once real messages are going out.
   */
  get isDevProvider(): boolean {
    return (DEV_PROVIDERS as readonly string[]).includes(this.provider.name);
  }

  /** Recent undelivered messages, for the admin testing endpoint. */
  getDevOutbox(): DevSmsRecord[] {
    return this.isDevProvider ? this.outbox.recent : [];
  }

  private buildProvider(): SmsProvider {
    const name = this.config.get('SMS_PROVIDER', { infer: true });

    switch (name) {
      case 'file':
        return new FileSmsProvider(
          { filePath: this.config.get('SMS_LOG_FILE', { infer: true }) },
          this.outbox,
        );

      case 'bulksmsbd':
        return new BulkSmsBdProvider({
          apiKey: this.config.get('SMS_API_KEY', { infer: true })!,
          senderId: this.config.get('SMS_SENDER_ID', { infer: true })!,
          endpoint: this.config.get('SMS_ENDPOINT', { infer: true }),
        });

      case 'twilio':
        return new TwilioProvider({
          accountSid: this.config.get('TWILIO_ACCOUNT_SID', { infer: true })!,
          authToken: this.config.get('TWILIO_AUTH_TOKEN', { infer: true })!,
          from: this.config.get('TWILIO_FROM', { infer: true })!,
        });

      case 'console':
      default:
        return new ConsoleSmsProvider(this.outbox);
    }
  }

  /**
   * Kept under 160 characters so it bills as a single SMS segment. Fewer
   * segments is not a micro-optimisation here: OTP volume is the single
   * largest recurring cost of a phone-first product.
   */
  async sendOtp(phone: string, code: string): Promise<SmsResult> {
    const ttlMinutes = Math.round(
      this.config.get('OTP_TTL_SECONDS', { infer: true }) / 60,
    );

    const message =
      `${code} is your WorkFlex BD verification code. ` +
      `It expires in ${ttlMinutes} minutes. Never share this code with anyone.`;

    try {
      return await this.provider.send(phone, message);
    } catch (err) {
      // Logged with the masked number so a failing gateway is diagnosable
      // without the log becoming a list of user phone numbers.
      this.logger.error(
        { err, phone: maskPhone(phone), provider: this.provider.name },
        'SMS delivery failed',
      );
      throw err;
    }
  }
}
