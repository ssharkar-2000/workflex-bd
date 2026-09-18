export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Display name for templates that greet the recipient. */
  toName?: string;
  /** Minutes until the code expires, for templates that show it separately. */
  expiryMinutes?: number;
}

export interface MailResult {
  delivered: boolean;
  providerRef?: string;
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<MailResult>;
}

export class MailDeliveryError extends Error {
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'MailDeliveryError';
  }
}
