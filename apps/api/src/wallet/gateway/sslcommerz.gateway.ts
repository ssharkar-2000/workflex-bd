import {
  GatewayError,
  type CreateSessionInput,
  type GatewayPayment,
  type PaymentGateway,
} from './payment-gateway';

/**
 * SSLCommerz, Bangladesh's largest payment gateway: bKash, Nagad, Rocket,
 * cards and internet banking behind one hosted page.
 *
 * Three calls are used, all from its v4 API:
 *   - session  — POST /gwprocess/v4/api.php, returns the page to send the
 *                payer to;
 *   - validate — GET  /validator/api/validationserverAPI.php, the gateway's
 *                own word on a payment, by the val_id it issued;
 *   - query    — GET  /validator/api/merchantTransIDvalidationAPI.php, every
 *                attempt against one of our tran_ids.
 *
 * The store password travels in the query string of the last two, which is
 * how SSLCommerz specifies them — so no URL built here is ever logged.
 */
export class SslcommerzGateway implements PaymentGateway {
  readonly name = 'sslcommerz' as const;
  private readonly base: string;

  constructor(
    private readonly storeId: string,
    private readonly storePassword: string,
    sandbox: boolean,
  ) {
    this.base = sandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
  }

  async createSession(input: CreateSessionInput): Promise<{ gatewayUrl: string }> {
    const form = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: input.amount.toFixed(2),
      currency: 'BDT',
      tran_id: input.tranId,
      success_url: input.callbacks.success,
      fail_url: input.callbacks.fail,
      cancel_url: input.callbacks.cancel,
      ipn_url: input.callbacks.ipn,

      cus_name: input.customer.name,
      cus_email: input.customer.email,
      cus_add1: input.customer.address,
      cus_city: input.customer.city,
      // The gateway asks for a postcode and this product never collects one.
      // Zeros say "not given" rather than inventing someone's area.
      cus_postcode: '0000',
      cus_country: 'Bangladesh',
      cus_phone: input.customer.phone,

      // Nothing is shipped: this is money going into a wallet.
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: 'WorkFlex BD wallet top-up',
      product_category: 'Wallet',
      product_profile: 'non-physical-goods',
    });

    const body = await this.request(`${this.base}/gwprocess/v4/api.php`, {
      method: 'POST',
      body: form,
    });

    const url = body.GatewayPageURL;
    if (body.status !== 'SUCCESS' || typeof url !== 'string' || !url) {
      const reason = String(body.failedreason || body.status || 'no reason given');
      throw new GatewayError(`SSLCommerz refused the payment session: ${reason}`);
    }
    return { gatewayUrl: url };
  }

  async validate(valId: string): Promise<GatewayPayment | null> {
    const body = await this.request(
      this.url('/validator/api/validationserverAPI.php', { val_id: valId, v: '1' }),
    );
    const payment = toGatewayPayment(body);
    // An unknown val_id comes back as INVALID_TRANSACTION with no tran_id.
    return payment.tranId ? payment : null;
  }

  async findByTranId(tranId: string): Promise<GatewayPayment[]> {
    const body = await this.request(
      this.url('/validator/api/merchantTransIDvalidationAPI.php', {
        tran_id: tranId,
      }),
    );
    const elements = Array.isArray(body.element) ? body.element : [];
    return elements.filter(isRecord).map(toGatewayPayment);
  }

  private url(path: string, params: Record<string, string>): string {
    const search = new URLSearchParams({
      ...params,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: 'json',
    });
    return `${this.base}${path}?${search.toString()}`;
  }

  private async request(
    url: string,
    init?: { method: 'POST'; body: URLSearchParams },
  ): Promise<Record<string, unknown>> {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      throw new GatewayError(
        `SSLCommerz could not be reached: ${(err as Error).message}`,
      );
    }

    const text = await res.text();
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Falls through to the error below — an HTML error page, usually.
    }
    throw new GatewayError(
      `SSLCommerz answered HTTP ${res.status} with something other than JSON`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads one payment out of an SSLCommerz response.
 *
 * Validation and transaction-query responses share these field names. The
 * gateway sends numbers as strings ("500.00", "0"), and a status this code
 * does not recognise is reported as UNKNOWN — never as success.
 */
export function toGatewayPayment(raw: Record<string, unknown>): GatewayPayment {
  const text = (key: string): string | null => {
    const value = raw[key];
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  };
  const num = (key: string): number | null => {
    const value = text(key);
    if (value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  return {
    status: statusOf(text('status')),
    tranId: text('tran_id') ?? '',
    valId: text('val_id'),
    amount: num('amount'),
    currency: text('currency'),
    bankTranId: text('bank_tran_id'),
    cardType: text('card_type'),
    riskLevel: num('risk_level'),
    riskTitle: text('risk_title'),
  };
}

function statusOf(status: string | null): GatewayPayment['status'] {
  switch (status?.toUpperCase()) {
    // VALIDATED is a VALID payment that has been validated before — the
    // IPN and the browser's return both asking about the same one.
    case 'VALID':
    case 'VALIDATED':
      return 'VALID';
    case 'FAILED':
    case 'INVALID_TRANSACTION':
    case 'EXPIRED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'PENDING':
    case 'UNATTEMPTED':
      return 'PENDING';
    default:
      return 'UNKNOWN';
  }
}
