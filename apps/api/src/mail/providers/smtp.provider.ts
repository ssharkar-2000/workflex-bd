import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import {
  MailDeliveryError,
  type MailMessage,
  type MailProvider,
  type MailResult,
} from '../mail-provider.interface';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** A Gmail App Password, not the account password — Gmail rejects SMTP auth otherwise. */
  pass: string;
  from: string;
}

/**
 * Plain SMTP delivery, aimed at Google's smtp.gmail.com but works against any
 * standard SMTP server. Kept as one lazily-created transporter per instance
 * so the TLS/auth handshake happens once, not per email.
 */
export class SmtpMailProvider implements MailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpMailProvider.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: message.toName ? `"${message.toName}" <${message.to}>` : message.to,
        subject: message.subject,
        text: message.text,
      });
      this.logger.log(`Email accepted by SMTP (${info.messageId})`);
      return { delivered: true, providerRef: info.messageId };
    } catch (err) {
      throw new MailDeliveryError(this.name, (err as Error).message);
    }
  }
}
