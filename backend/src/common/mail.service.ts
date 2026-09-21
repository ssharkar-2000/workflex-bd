import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Thin wrapper around nodemailer. Real SMTP delivery needs credentials this
 * sandbox can't reach (no network egress to any mail provider here), so this
 * is written defensively: if SMTP_HOST/SMTP_USER/SMTP_PASS aren't set in the
 * environment, `send()` just logs and returns instead of throwing — the rest
 * of the app (maintenance scheduling, notifications) keeps working even
 * without email configured, it just won't actually deliver anything.
 *
 * To enable real delivery, set in `.env`:
 *   SMTP_HOST=smtp.yourprovider.com
 *   SMTP_PORT=587
 *   SMTP_USER=you@yourdomain.com
 *   SMTP_PASS=your-smtp-password
 *   SMTP_FROM="WorkFlex BD <no-reply@workflexbd.com>"
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return this.transporter;
  }

  async send(to: string[], subject: string, text: string): Promise<void> {
    if (to.length === 0) return;
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(
        `SMTP is not configured — skipping email "${subject}" to ${to.length} recipient(s). ` +
          'Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to enable real delivery.',
      );
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: to.join(','),
        subject,
        text,
      });
    } catch (err) {
      // Email is a best-effort side channel here — the in-app Notification
      // row is the source of truth, so a failed send shouldn't blow up the
      // maintenance-scheduling flow that triggered it.
      this.logger.error(`Failed to send email "${subject}": ${(err as Error).message}`);
    }
  }
}
