import { randomBytes } from 'node:crypto';
import type {
  CreateSessionInput,
  GatewayPayment,
  PaymentGateway,
} from './payment-gateway';

/** What the person on the simulator page chose. */
export const SIMULATOR_OUTCOMES = [
  'bkash',
  'nagad',
  'card',
  'risky',
  'fail',
  'cancel',
] as const;
export type SimulatorOutcome = (typeof SIMULATOR_OUTCOMES)[number];

/** `card_type` as SSLCommerz would report each simulated method. */
const CARD_TYPES: Partial<Record<SimulatorOutcome, string>> = {
  bkash: 'BKASH-BKash',
  nagad: 'NAGAD-Nagad',
  card: 'VISA-Simulator card',
  // Paid with bKash, but flagged — for trying the admin review of held top-ups.
  risky: 'BKASH-BKash',
};

interface Session {
  tranId: string;
  amount: number;
  callbacks: CreateSessionInput['callbacks'];
  createdAt: number;
}

const DAY_MS = 86_400_000;

/**
 * A stand-in for SSLCommerz, for development without a merchant account.
 *
 * Its payment page is served by this API (see PaymentCallbacksController) and
 * posts back to the same success/fail/cancel endpoints SSLCommerz uses, with
 * the same field names, so the code that settles a real payment is the code
 * a simulated one exercises. Validation answers from what the simulated payer
 * actually chose — a val_id exists only once someone has pressed Pay.
 *
 * Held in memory: restarting the API forgets unfinished simulated payments,
 * which is acceptable for something that must never run in production (the
 * API refuses to start with it there).
 */
export class SimulatorGateway implements PaymentGateway {
  readonly name = 'simulator' as const;

  private readonly sessions = new Map<string, Session>();
  private readonly attempts = new Map<string, GatewayPayment[]>();
  private readonly byValId = new Map<string, GatewayPayment>();

  async createSession(input: CreateSessionInput): Promise<{ gatewayUrl: string }> {
    this.prune();
    this.sessions.set(input.tranId, {
      tranId: input.tranId,
      amount: input.amount,
      callbacks: input.callbacks,
      createdAt: Date.now(),
    });
    return {
      gatewayUrl: `${input.publicBaseUrl}/payments/simulator/${encodeURIComponent(input.tranId)}`,
    };
  }

  /** The open session behind a simulator page, or null. */
  session(tranId: string): { amount: number } | null {
    const session = this.sessions.get(tranId);
    return session ? { amount: session.amount } : null;
  }

  /**
   * Records what the simulated payer did, and returns what the gateway would
   * post back and where — the fields SSLCommerz sends to the success, fail
   * or cancel URL.
   */
  complete(
    tranId: string,
    outcome: SimulatorOutcome,
  ): { action: string; fields: Record<string, string>; paid: boolean } | null {
    const session = this.sessions.get(tranId);
    if (!session) return null;

    const cardType = CARD_TYPES[outcome] ?? null;
    const paid = cardType !== null;
    const status = paid ? 'VALID' : outcome === 'fail' ? 'FAILED' : 'CANCELLED';
    const valId = paid ? `SIM${randomBytes(8).toString('hex').toUpperCase()}` : null;
    const bankTranId = paid ? `SIMBANK${randomBytes(6).toString('hex').toUpperCase()}` : null;

    const payment: GatewayPayment = {
      status,
      tranId,
      valId,
      amount: session.amount,
      currency: 'BDT',
      bankTranId,
      cardType,
      riskLevel: paid ? (outcome === 'risky' ? 1 : 0) : null,
      riskTitle: paid
        ? outcome === 'risky'
          ? 'Simulated: flagged for review'
          : 'Safe'
        : null,
    };

    this.attempts.set(tranId, [...(this.attempts.get(tranId) ?? []), payment]);
    if (valId) this.byValId.set(valId, payment);

    const fields: Record<string, string> = {
      status,
      tran_id: tranId,
      amount: session.amount.toFixed(2),
      currency: 'BDT',
    };
    if (valId && bankTranId && cardType) {
      fields.val_id = valId;
      fields.bank_tran_id = bankTranId;
      fields.card_type = cardType;
    }

    const action = paid
      ? session.callbacks.success
      : outcome === 'fail'
        ? session.callbacks.fail
        : session.callbacks.cancel;

    return { action, fields, paid };
  }

  async validate(valId: string): Promise<GatewayPayment | null> {
    return this.byValId.get(valId) ?? null;
  }

  async findByTranId(tranId: string): Promise<GatewayPayment[]> {
    return this.attempts.get(tranId) ?? [];
  }

  /** Forgets sessions nobody finished within a day. */
  private prune(): void {
    const cutoff = Date.now() - DAY_MS;
    for (const [tranId, session] of this.sessions) {
      if (session.createdAt < cutoff) this.sessions.delete(tranId);
    }
  }
}
