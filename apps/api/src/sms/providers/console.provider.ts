import { Logger } from '@nestjs/common';
import { maskPhone } from '@workflex/shared';
import type { SmsProvider, SmsResult } from '../sms-provider.interface';
import type { DevOutbox } from '../dev-outbox';

/**
 * Development only. Prints the message instead of sending it.
 *
 * Convenient while you have a terminal in front of you. Prefer the `file`
 * provider once the log gets noisy — it keeps live codes out of the
 * application log.
 *
 * validateEnv() refuses to boot with NODE_ENV=production and this provider
 * selected — a real user must never have their code written to a log.
 */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  constructor(private readonly outbox: DevOutbox) {}

  async send(phone: string, message: string): Promise<SmsResult> {
    const entry = this.outbox.record(phone, message);

    // Plain ASCII on purpose: the default Windows PowerShell codepage renders
    // box-drawing characters and em-dashes as mojibake, and this box exists to
    // be read.
    this.logger.warn(
      `\n` +
        `  +----------------------------------------------------+\n` +
        `  |  DEV SMS - not actually sent                       |\n` +
        `  |  To:   ${maskPhone(phone).padEnd(44)}|\n` +
        `  |  CODE: ${(entry.code ?? 'n/a').padEnd(44)}|\n` +
        `  +----------------------------------------------------+`,
    );

    return { delivered: true, providerRef: 'console' };
  }
}
