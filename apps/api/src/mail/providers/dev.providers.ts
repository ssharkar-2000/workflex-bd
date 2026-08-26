import { Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { extractOtpCode } from '../../common/otp-code.util';
import {
  MailDeliveryError,
  type MailMessage,
  type MailProvider,
  type MailResult,
} from '../mail-provider.interface';

/** Appends one JSON line per message, mirroring the SMS file provider. */
export class FileMailProvider implements MailProvider {
  readonly name = 'file';
  private readonly logger = new Logger(FileMailProvider.name);
  private readonly filePath: string;
  private directoryReady = false;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  async send(message: MailMessage): Promise<MailResult> {
    const entry = {
      ...message,
      code: extractOtpCode(message.text),
      sentAt: new Date().toISOString(),
    };

    try {
      if (!this.directoryReady) {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.directoryReady = true;
      }
      await appendFile(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (err) {
      throw new MailDeliveryError(
        this.name,
        `Could not write to ${this.filePath}: ${(err as Error).message}`,
      );
    }

    this.logger.log(`Email written to ${this.filePath}`);
    return { delivered: true, providerRef: 'file' };
  }
}

export class ConsoleMailProvider implements MailProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async send(message: MailMessage): Promise<MailResult> {
    this.logger.warn(
      `\n` +
        `  +----------------------------------------------------+\n` +
        `  |  DEV EMAIL - not actually sent                     |\n` +
        `  |  To:      ${message.to.slice(0, 41).padEnd(41)}|\n` +
        `  |  Subject: ${message.subject.slice(0, 41).padEnd(41)}|\n` +
        `  |  ${message.text.slice(0, 50).padEnd(50)}|\n` +
        `  +----------------------------------------------------+`,
    );
    return { delivered: true, providerRef: 'console' };
  }
}
