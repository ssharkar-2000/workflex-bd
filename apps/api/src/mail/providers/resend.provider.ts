import { Logger } from '@nestjs/common';
import {
  MailDeliveryError,
  type MailMessage,
  type MailProvider,
  type MailResult,
} from '../mail-provider.interface';

export interface ResendConfig {
  apiKey: string;
  from: string;
}

/**
 * Resend's HTTP API. Chosen over SMTP so email needs no extra dependency and
 * no long-lived connection — one POST, same shape as the SMS gateways.
 */
export class ResendMailProvider implements MailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendMailProvider.name);

  constructor(private readonly config: ResendConfig) {}

  async send(message: MailMessage): Promise<MailResult> {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new MailDeliveryError(
        this.name,
        `Network failure: ${(err as Error).message}`,
      );
    }

    const json = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new MailDeliveryError(
        this.name,
        json.message ?? `HTTP ${response.status}`,
      );
    }

    this.logger.log(`Email accepted (id ${json.id})`);
    return { delivered: true, providerRef: json.id };
  }
}
