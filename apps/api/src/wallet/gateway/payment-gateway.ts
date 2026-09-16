import type { PaymentGateway as GatewayName } from '@workflex/shared';

/**
 * A hosted payment page that takes money on our behalf.
 *
 * The person pays on the gateway's own page, never ours, so card numbers and
 * bKash PINs are never seen by this API. What comes back is a reference the
 * gateway issued (`val_id`), and nothing a callback says is believed until
 * the gateway has been asked about that reference directly — see
 * TopUpService.settle.
 */
export interface PaymentGateway {
  readonly name: GatewayName;

  /** Opens a payment for one top-up and returns the page to send the payer to. */
  createSession(input: CreateSessionInput): Promise<{ gatewayUrl: string }>;

  /**
   * What the gateway's own records say about the payment behind a `val_id`.
   * Null when it has never heard of it.
   */
  validate(valId: string): Promise<GatewayPayment | null>;

  /**
   * Every attempt made against one of our references, for settling a top-up
   * whose callback never arrived — the payer closed the browser, or the
   * network dropped between the gateway and us.
   */
  findByTranId(tranId: string): Promise<GatewayPayment[]>;
}

export interface CreateSessionInput {
  /** Our reference for this top-up — the gateway's `tran_id`. */
  tranId: string;
  /** Whole taka. */
  amount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
  /** Where the gateway posts results. See TopUpService.callbackUrls. */
  callbacks: {
    success: string;
    fail: string;
    cancel: string;
    ipn: string;
  };
  /** This API's public base URL, ending in /api/v1. */
  publicBaseUrl: string;
}

/** One payment attempt, as the gateway reports it. */
export interface GatewayPayment {
  /**
   * VALID is the only status that means money was taken. Everything the
   * gateway could say is folded into these five so the rest of the code
   * cannot misread a status it has never seen as success.
   */
  status: 'VALID' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'UNKNOWN';
  tranId: string;
  valId: string | null;
  /** As the gateway reports it — compared against ours before crediting. */
  amount: number | null;
  currency: string | null;
  bankTranId: string | null;
  /** How it was paid: "BKASH-BKash", "VISA-Dutch Bangla". */
  cardType: string | null;
  /** 1 means the gateway wants the payment checked before it is honoured. */
  riskLevel: number | null;
  riskTitle: string | null;
}

/** Nest injection token. Resolves to null when PAYMENT_PROVIDER=off. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** Raised when the gateway refuses a request or cannot be reached. */
export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}
