import { z } from 'zod';
import { isValidBdPhone, normalizeBdPhone } from './phone';

/**
 * The wallet.
 *
 * Money moves through it three ways: a recruiter adds money through the
 * payment gateway, pays someone they hired out of it, and the person who was
 * paid takes their earnings out to bKash, Nagad or a bank account.
 *
 * Amounts are whole taka everywhere — in the database, on the wire and on
 * screen. Wages in this market are quoted in whole taka, bKash and Nagad
 * transfers are made in whole taka, and an integer cannot drift the way a
 * fraction of a taka held as a float does once it has been added up a
 * thousand times.
 */

export const WALLET_LIMITS = {
  /**
   * SSLCommerz's own range for a single payment. The gateway refuses anything
   * outside it, so it is refused here first, with a message that says why.
   */
  topUpMin: 10,
  topUpMax: 500_000,
  paymentMin: 10,
  withdrawalMin: 10,
  /**
   * A sanity ceiling on one payment or withdrawal. The real limit is the
   * wallet balance; this only stops a figure typed with three extra zeros
   * from being taken at face value before the balance check says no.
   */
  transferMax: 1_000_000,
} as const;

/** "৳1,250" — Latin digits, the way pay is written on every job card. */
export function formatTaka(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}৳${Math.abs(amount).toLocaleString('en-US')}`;
}

/**
 * An amount typed into a form.
 *
 * Coerced, so a text field's string and a number are both accepted. Whole
 * taka only, for the reason at the top of this file.
 */
function takaAmount(min: number, max: number) {
  return z.coerce
    .number({ invalid_type_error: 'Enter an amount in taka' })
    .int('Enter a whole number of taka')
    .min(min, `The smallest amount is ${formatTaka(min)}`)
    .max(max, `The largest amount is ${formatTaka(max)}`);
}

/** Mirrors the Prisma enum of the same name. */
export const walletEntryTypeSchema = z.enum([
  'TOP_UP',
  'PAYMENT_SENT',
  'PAYMENT_RECEIVED',
  'WITHDRAWAL',
  'WITHDRAWAL_RETURNED',
]);
export type WalletEntryType = z.infer<typeof walletEntryTypeSchema>;

/** Mirrors the Prisma enum of the same name. */
export const topUpStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'HELD',
  'REJECTED',
]);
export type TopUpStatus = z.infer<typeof topUpStatusSchema>;

/** Mirrors the Prisma enum of the same name. */
export const payoutMethodSchema = z.enum(['BKASH', 'NAGAD', 'BANK']);
export type PayoutMethod = z.infer<typeof payoutMethodSchema>;

/** Mirrors the Prisma enum of the same name. */
export const withdrawalStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'REJECTED',
  'CANCELLED',
]);
export type WithdrawalStatus = z.infer<typeof withdrawalStatusSchema>;

/**
 * Which gateway takes the money. `simulator` exists only in development and
 * the API refuses to start with it in production; the app labels it plainly
 * so nobody takes a simulated payment for a real one.
 */
export const paymentGatewaySchema = z.enum(['sslcommerz', 'simulator']);
export type PaymentGateway = z.infer<typeof paymentGatewaySchema>;

/**
 * How a top-up was paid, from the gateway's `card_type`.
 *
 * SSLCommerz reports it as "SCHEME-Issuer" — "BKASH-BKash",
 * "VISA-Dutch Bangla". The two mobile wallets people name by brand get their
 * brand's own spelling; anything else is shown as the gateway wrote it rather
 * than guessed at, because a wrong name for how someone paid is worse than an
 * unpolished one.
 */
export function topUpMethodLabel(cardType: string | null): string | null {
  if (!cardType) return null;
  const [scheme = '', issuer] = cardType.split('-', 2);
  if (/bkash/i.test(scheme)) return 'bKash';
  if (/nagad/i.test(scheme)) return 'Nagad';
  return issuer?.trim() || scheme.trim() || null;
}

// --- requests ---

export const createTopUpSchema = z.object({
  amount: takaAmount(WALLET_LIMITS.topUpMin, WALLET_LIMITS.topUpMax),
  /**
   * Where the person lands after paying: the app's own link on a phone, the
   * wallet page on the web. The server accepts only addresses it recognises —
   * anything else would let a crafted request send someone from the payment
   * page to a lookalike site.
   */
  returnUrl: z.string().trim().url().max(500),
});
export type CreateTopUpDto = z.output<typeof createTopUpSchema>;
export type CreateTopUpInput = z.input<typeof createTopUpSchema>;

export const createPaymentSchema = z.object({
  jobId: z.string().uuid(),
  payeeId: z.string().uuid(),
  amount: takaAmount(WALLET_LIMITS.paymentMin, WALLET_LIMITS.transferMax),
  /** Shown on both statements — "3 days, Friday to Sunday". */
  note: z.string().trim().max(200).optional().or(z.literal('')),
  /**
   * Chosen by the app once per confirmation. A second request carrying the
   * same value is the same payment arriving twice — a double tap, a retry on
   * a dropped connection — and is answered with the first one's receipt
   * instead of paying again.
   */
  requestId: z.string().uuid(),
});
export type CreatePaymentDto = z.output<typeof createPaymentSchema>;
export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

const withdrawalBase = {
  amount: takaAmount(WALLET_LIMITS.withdrawalMin, WALLET_LIMITS.transferMax),
  /** As the bank or bKash has it — the person sending the money checks it. */
  accountName: z
    .string()
    .trim()
    .min(2, "Enter the account holder's name")
    .max(80),
  /** Same role as on payments: a retried request is not a second withdrawal. */
  requestId: z.string().uuid(),
};

/** bKash and Nagad accounts are phone numbers, stored as +8801XXXXXXXXX. */
function mobileWalletWithdrawal<M extends 'BKASH' | 'NAGAD'>(method: M) {
  return z.object({
    method: z.literal(method),
    ...withdrawalBase,
    accountNumber: z
      .string()
      .trim()
      .refine(isValidBdPhone, 'Enter the 11-digit number of the account')
      .transform(normalizeBdPhone),
  });
}

export const createWithdrawalSchema = z.discriminatedUnion('method', [
  mobileWalletWithdrawal('BKASH'),
  mobileWalletWithdrawal('NAGAD'),
  z.object({
    method: z.literal('BANK'),
    ...withdrawalBase,
    bankName: z.string().trim().min(2, 'Enter the name of the bank').max(80),
    branchName: z.string().trim().min(2, 'Enter the branch').max(80),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,20}$/, 'Enter the account number, digits only'),
    /** Optional: the branch name identifies it, but it speeds the transfer. */
    routingNumber: z
      .string()
      .trim()
      .regex(/^\d{9}$/, 'A routing number is 9 digits')
      .optional()
      .or(z.literal('')),
  }),
]);
export type CreateWithdrawalDto = z.output<typeof createWithdrawalSchema>;
export type CreateWithdrawalInput = z.input<typeof createWithdrawalSchema>;

// --- responses ---

export const walletSummarySchema = z.object({
  /** Everything in the wallet. */
  balance: z.number().int(),
  /**
   * The part of `balance` that was earned — paid in by someone who hired this
   * account — and so can be withdrawn. Money added through the gateway is for
   * paying people and stays in the wallet.
   */
  withdrawable: z.number().int(),
  /** Asked for and not yet sent. Already taken out of `balance`. */
  pendingWithdrawals: z.number().int(),
  /** Withdrawing needs a verified identity (level 1). */
  canWithdraw: z.boolean(),
  /** Null when no gateway is configured, so money cannot be added right now. */
  gateway: paymentGatewaySchema.nullable(),
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;

export const walletEntrySchema = z.object({
  id: z.string().uuid(),
  type: walletEntryTypeSchema,
  /** Signed: positive into the wallet, negative out of it. */
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  createdAt: z.string(),
  /** The other side of a payment — who paid you, or whom you paid. */
  counterparty: z.string().nullable(),
  jobTitle: z.string().nullable(),
  note: z.string().nullable(),
  /** How a top-up was paid, as the gateway reported it. */
  topUpMethod: z.string().nullable(),
  withdrawal: z
    .object({
      id: z.string().uuid(),
      method: payoutMethodSchema,
      /** Masked. A statement is not the place for a full account number. */
      account: z.string(),
      status: withdrawalStatusSchema,
      /** The transfer's transaction ID, once it has been sent. */
      reference: z.string().nullable(),
      rejectReason: z.string().nullable(),
    })
    .nullable(),
});
export type WalletEntry = z.infer<typeof walletEntrySchema>;

export const walletStatementSchema = z.object({
  entries: z.array(walletEntrySchema),
  /** Pass back as `cursor` for the next, older page. Null on the last page. */
  nextCursor: z.string().nullable(),
});
export type WalletStatement = z.infer<typeof walletStatementSchema>;

/** Where to send the person to pay. */
export const topUpSessionSchema = z.object({
  id: z.string().uuid(),
  gatewayUrl: z.string().url(),
});
export type TopUpSession = z.infer<typeof topUpSessionSchema>;

export const topUpSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int(),
  status: topUpStatusSchema,
  method: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type TopUp = z.infer<typeof topUpSchema>;

/** Someone this account hired, as the payment screen lists them. */
export const payeeSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string(),
  payeeId: z.string().uuid(),
  name: z.string(),
  /** Hired people share numbers — the two of them have work to arrange. */
  phone: z.string(),
  /** Paid through the wallet for this job so far. */
  paidSoFar: z.number().int(),
  hiredAt: z.string(),
});
export type Payee = z.infer<typeof payeeSchema>;

export const payeeListSchema = z.object({ payees: z.array(payeeSchema) });
export type PayeeList = z.infer<typeof payeeListSchema>;

export const paymentReceiptSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int(),
  payeeName: z.string(),
  jobTitle: z.string(),
  /** The payer's balance after paying. */
  balance: z.number().int(),
  createdAt: z.string(),
});
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;

export const withdrawalSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int(),
  method: payoutMethodSchema,
  accountName: z.string(),
  accountNumber: z.string(),
  bankName: z.string().nullable(),
  branchName: z.string().nullable(),
  status: withdrawalStatusSchema,
  reference: z.string().nullable(),
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
  processedAt: z.string().nullable(),
});
export type Withdrawal = z.infer<typeof withdrawalSchema>;

// --- admin ---

const countAndTotal = z.object({
  count: z.number().int(),
  total: z.number().int(),
});

export const adminWalletSummarySchema = z.object({
  /** Null when no gateway is configured and top-ups are switched off. */
  gateway: paymentGatewaySchema.nullable(),
  /** Everything users hold, and how much of it they could ask to withdraw. */
  heldInWallets: z.number().int(),
  withdrawableInWallets: z.number().int(),
  pendingWithdrawals: countAndTotal,
  /** Paid at the gateway but flagged as risky, so not credited yet. */
  heldTopUps: z.number().int(),
  last30Days: z.object({
    topUps: countAndTotal,
    payments: countAndTotal,
    withdrawalsPaid: countAndTotal,
  }),
});
export type AdminWalletSummary = z.infer<typeof adminWalletSummarySchema>;

export const adminWithdrawalSchema = withdrawalSchema.extend({
  userId: z.string().uuid(),
  userName: z.string().nullable(),
  userPhone: z.string(),
  routingNumber: z.string().nullable(),
});
export type AdminWithdrawal = z.infer<typeof adminWithdrawalSchema>;

export const adminWithdrawalListSchema = z.object({
  withdrawals: z.array(adminWithdrawalSchema),
});
export type AdminWithdrawalList = z.infer<typeof adminWithdrawalListSchema>;

export const adminTopUpSchema = topUpSchema.extend({
  userId: z.string().uuid(),
  userName: z.string().nullable(),
  userPhone: z.string(),
  /** Our reference at the gateway, for finding the payment in its panel. */
  tranId: z.string(),
  valId: z.string().nullable(),
  bankTranId: z.string().nullable(),
  /** The gateway's fraud signal: 1 means it asked for the payment to be checked. */
  riskLevel: z.number().int().nullable(),
  riskTitle: z.string().nullable(),
  reviewNote: z.string().nullable(),
});
export type AdminTopUp = z.infer<typeof adminTopUpSchema>;

export const adminTopUpListSchema = z.object({
  topUps: z.array(adminTopUpSchema),
});
export type AdminTopUpList = z.infer<typeof adminTopUpListSchema>;

/** Marking a withdrawal as sent. */
export const payWithdrawalSchema = z.object({
  /** The transfer's transaction ID — what the person quotes if it has not arrived. */
  reference: z
    .string()
    .trim()
    .min(4, 'Enter the transaction ID of the transfer')
    .max(64),
});
export type PayWithdrawalDto = z.output<typeof payWithdrawalSchema>;

/** Turning down a withdrawal or a held top-up. The reason is shown to the person. */
export const walletRejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Give a reason the person can act on')
    .max(500),
});
export type WalletRejectDto = z.output<typeof walletRejectSchema>;
