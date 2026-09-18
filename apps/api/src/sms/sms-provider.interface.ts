export interface SmsResult {
  delivered: boolean;
  providerRef?: string;
}

/**
 * One interface, several gateways. The OTP flow never learns which provider
 * is configured, so switching gateways — or adding a failover — touches only
 * this folder.
 */
export interface SmsProvider {
  readonly name: string;

  /**
   * Deliver a message. Must throw on failure rather than returning false,
   * so a failed send never leaves the caller believing a code was sent.
   */
  send(phone: string, message: string): Promise<SmsResult>;
}

export class SmsDeliveryError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly providerCode?: string,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'SmsDeliveryError';
  }
}
