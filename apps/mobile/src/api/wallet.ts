import {
  payeeListSchema,
  paymentReceiptSchema,
  topUpSchema,
  topUpSessionSchema,
  walletStatementSchema,
  walletSummarySchema,
  withdrawalSchema,
  type CreatePaymentInput,
  type CreateTopUpInput,
  type CreateWithdrawalInput,
  type PayeeList,
  type PaymentReceipt,
  type TopUp,
  type TopUpSession,
  type WalletStatement,
  type WalletSummary,
  type Withdrawal,
} from '@workflex/shared';
import { api } from './client';

export async function fetchWallet(): Promise<WalletSummary> {
  const { data } = await api.get('/wallet');
  return walletSummarySchema.parse(data);
}

/** The ledger, newest first. Pass the previous page's `nextCursor` for more. */
export async function fetchStatement(cursor?: string): Promise<WalletStatement> {
  const { data } = await api.get('/wallet/statement', { params: { cursor } });
  return walletStatementSchema.parse(data);
}

/** Opens a payment at the gateway and returns the page to send the person to. */
export async function createTopUp(input: CreateTopUpInput): Promise<TopUpSession> {
  const { data } = await api.post('/wallet/top-ups', input);
  return topUpSessionSchema.parse(data);
}

/**
 * Where a top-up has got to. The server asks the gateway about pending ones
 * before answering, so polling this is also what settles a payment whose
 * callback never arrived.
 */
export async function fetchTopUp(id: string): Promise<TopUp> {
  const { data } = await api.get(`/wallet/top-ups/${id}`);
  return topUpSchema.parse(data);
}

/** Everyone hired on this account's postings, and what each has been paid. */
export async function fetchPayees(): Promise<PayeeList> {
  const { data } = await api.get('/wallet/payees');
  return payeeListSchema.parse(data);
}

export async function payHire(input: CreatePaymentInput): Promise<PaymentReceipt> {
  const { data } = await api.post('/wallet/payments', input);
  return paymentReceiptSchema.parse(data);
}

export async function requestWithdrawal(input: CreateWithdrawalInput): Promise<Withdrawal> {
  const { data } = await api.post('/wallet/withdrawals', input);
  return withdrawalSchema.parse(data);
}

export async function cancelWithdrawal(id: string): Promise<Withdrawal> {
  const { data } = await api.post(`/wallet/withdrawals/${id}/cancel`);
  return withdrawalSchema.parse(data);
}
