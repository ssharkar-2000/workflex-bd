import { extractOtpCode } from '../common/otp-code.util';

/** Re-exported under the old name so existing imports keep working. */
export { extractOtpCode as extractCode };

export interface DevSmsRecord {
  phone: string;
  message: string;
  /** The 6-digit code pulled out of the message, for convenience. */
  code: string | null;
  sentAt: string;
}

/**
 * A bounded, in-process record of messages that were never delivered.
 *
 * Shared by the development providers so the admin endpoint works the same
 * way regardless of which one is selected. Deliberately in-memory: plaintext
 * codes never reach the database — where only the HMAC is stored — and the
 * buffer dies with the process.
 */
export class DevOutbox {
  private readonly items: DevSmsRecord[] = [];

  constructor(private readonly limit = 20) {}

  record(phone: string, message: string): DevSmsRecord {
    const entry: DevSmsRecord = {
      phone,
      message,
      code: extractOtpCode(message),
      sentAt: new Date().toISOString(),
    };

    this.items.push(entry);
    if (this.items.length > this.limit) this.items.shift();

    return entry;
  }

  /** Newest first. */
  get recent(): DevSmsRecord[] {
    return [...this.items].reverse();
  }
}
