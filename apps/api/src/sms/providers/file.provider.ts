import { Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { maskPhone } from '@workflex/shared';
import type { SmsProvider, SmsResult } from '../sms-provider.interface';
import { SmsDeliveryError } from '../sms-provider.interface';
import type { DevOutbox } from '../dev-outbox';

export interface FileSmsConfig {
  /** Relative paths resolve against the API working directory. */
  filePath: string;
}

/**
 * Writes messages to a dedicated log file instead of sending them.
 *
 * The point of a separate file rather than the application log: OTP codes are
 * live credentials for the few minutes they exist. The API log is noisy,
 * gets tailed during unrelated debugging, and in any real deployment is
 * shipped to a log aggregator — none of which should be true of a file
 * containing valid login codes.
 *
 * One JSON object per line, so it can be tailed by eye or parsed by a test.
 *
 * Development only. validateEnv() refuses to boot with this in production.
 */
export class FileSmsProvider implements SmsProvider {
  readonly name = 'file';
  private readonly logger = new Logger(FileSmsProvider.name);
  private readonly filePath: string;
  private directoryReady = false;

  constructor(
    config: FileSmsConfig,
    private readonly outbox: DevOutbox,
  ) {
    this.filePath = resolve(config.filePath);
  }

  async send(phone: string, message: string): Promise<SmsResult> {
    const entry = this.outbox.record(phone, message);

    try {
      if (!this.directoryReady) {
        await mkdir(dirname(this.filePath), { recursive: true });
        this.directoryReady = true;
      }
      await appendFile(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (err) {
      throw new SmsDeliveryError(
        this.name,
        `Could not write to ${this.filePath}: ${(err as Error).message}`,
      );
    }

    // The application log records that a code was issued, never the code
    // itself — that is the whole reason the separate file exists.
    this.logger.log(
      `SMS written to ${this.filePath} for ${maskPhone(phone)}`,
    );

    return { delivered: true, providerRef: 'file' };
  }
}
