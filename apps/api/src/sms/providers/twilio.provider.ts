import { Logger } from '@nestjs/common';
import { maskPhone } from '@workflex/shared';
import {
  SmsDeliveryError,
  type SmsProvider,
  type SmsResult,
} from '../sms-provider.interface';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** A Twilio number in E.164, or an approved alphanumeric sender ID. */
  from: string;
}

/**
 * Twilio.
 *
 * More expensive per message than a local gateway, but it needs no contract
 * or sender-ID registration — sign up, add a card, and it works. That makes
 * it the sensible provider for a closed beta, with a Bangladeshi gateway
 * swapped in once volume justifies the paperwork.
 *
 * Called over plain fetch rather than the Twilio SDK: one HTTP request does
 * not justify the dependency.
 */
export class TwilioProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioProvider.name);

  constructor(private readonly config: TwilioConfig) {}

  async send(phone: string, message: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const auth = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`,
    ).toString('base64');

    const body = new URLSearchParams({
      To: phone,
      From: this.config.from,
      Body: message,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new SmsDeliveryError(
        this.name,
        `Network failure contacting Twilio: ${(err as Error).message}`,
      );
    }

    const json = (await response.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!response.ok) {
      throw new SmsDeliveryError(
        this.name,
        json.message ?? `HTTP ${response.status}`,
        json.code ? String(json.code) : undefined,
      );
    }

    this.logger.log(`SMS accepted for ${maskPhone(phone)} (sid ${json.sid})`);
    return { delivered: true, providerRef: json.sid };
  }
}
