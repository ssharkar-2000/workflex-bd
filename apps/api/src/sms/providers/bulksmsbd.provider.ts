import { Logger } from '@nestjs/common';
import { maskPhone } from '@workflex/shared';
import {
  SmsDeliveryError,
  type SmsProvider,
  type SmsResult,
} from '../sms-provider.interface';

export interface BulkSmsBdConfig {
  apiKey: string;
  senderId: string;
  /** Overridable because gateways move endpoints and some resell white-label. */
  endpoint: string;
}

/**
 * BulkSMSBD-style HTTP gateway.
 *
 * This shape (api_key / senderid / number / message over a single HTTP call)
 * is shared by most Bangladeshi resellers — BulkSMSBD, MIMSMS, Adn Diginet
 * and others — so pointing SMS_ENDPOINT at a different vendor usually works
 * without code changes.
 *
 * Verify the exact parameter names and success codes against your own
 * dashboard before going live; vendors differ in the details.
 */
export class BulkSmsBdProvider implements SmsProvider {
  readonly name = 'bulksmsbd';
  private readonly logger = new Logger(BulkSmsBdProvider.name);

  constructor(private readonly config: BulkSmsBdConfig) {}

  async send(phone: string, message: string): Promise<SmsResult> {
    // These gateways expect a local-format number (01712345678), not E.164.
    const localNumber = phone.replace(/^\+880/, '0');

    const body = new URLSearchParams({
      api_key: this.config.apiKey,
      type: 'text',
      number: localNumber,
      senderid: this.config.senderId,
      message,
    });

    let response: Response;
    try {
      response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new SmsDeliveryError(
        this.name,
        `Network failure contacting gateway: ${(err as Error).message}`,
      );
    }

    const text = await response.text();

    if (!response.ok) {
      throw new SmsDeliveryError(
        this.name,
        `Gateway returned HTTP ${response.status}: ${text.slice(0, 200)}`,
        String(response.status),
      );
    }

    // Success is reported in the body, not the status code — HTTP 200 with an
    // error payload is normal for these vendors.
    const parsed = this.parse(text);

    if (parsed.code !== '202') {
      throw new SmsDeliveryError(
        this.name,
        `Gateway rejected the message: ${parsed.message}`,
        parsed.code,
      );
    }

    this.logger.log(`SMS accepted for ${maskPhone(phone)}`);
    return { delivered: true, providerRef: parsed.messageId };
  }

  private parse(text: string): {
    code: string;
    message: string;
    messageId?: string;
  } {
    try {
      const json = JSON.parse(text) as {
        response_code?: number | string;
        success_message?: string;
        error_message?: string;
        message_id?: string;
      };
      return {
        code: String(json.response_code ?? ''),
        message: json.success_message ?? json.error_message ?? text.slice(0, 200),
        messageId: json.message_id,
      };
    } catch {
      // Some vendors return bare text rather than JSON.
      return { code: text.trim(), message: text.slice(0, 200) };
    }
  }
}
