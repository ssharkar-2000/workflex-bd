import { depositInstructionsSchema, depositListSchema, depositSchema, walletCodeSchema, resolvedWalletSchema, receivedPaymentsSchema,
  type CreateDepositInput, type Deposit, type DepositInstructions, type WalletCode, type ResolvedWallet, type CreateTransferInput, type ReceiptQuery } from '@workflex/shared';
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

/** The platform's own bKash, Nagad and bank accounts, for the add-money screen. */
export async function fetchDepositAccounts(): Promise<DepositInstructions> {
  const { data } = await api.get('/wallet/deposit-accounts');
  return depositInstructionsSchema.parse(data);
}

/**
 * Declare money already sent to one of those accounts. Comes back PENDING —
 * nothing is credited until someone has found it on the statement.
 */
export async function declareDeposit(input: CreateDepositInput): Promise<Deposit> {
  const { data } = await api.post('/wallet/deposits', input);
  return depositSchema.parse(data);
}

/** This account's declared deposits, newest first. */
export async function fetchDeposits(): Promise<Deposit[]> {
  const { data } = await api.get('/wallet/deposits');
  return depositListSchema.parse(data).deposits;
}

export async function fetchDeposit(id: string): Promise<Deposit> {
  const { data } = await api.get(`/wallet/deposits/${id}`);
  return depositSchema.parse(data);
}

/** This wallet as a QR payload and a short code, for someone else to scan. */
export async function fetchWalletCode(): Promise<WalletCode> {
  const { data } = await api.get('/wallet/code');
  return walletCodeSchema.parse(data);
}

/** Who a scanned code, account id or phone number belongs to. */
export async function resolveWallet(code: string): Promise<ResolvedWallet> {
  const { data } = await api.get('/wallet/resolve', { params: { code } });
  return resolvedWalletSchema.parse(data);
}

/** Send money to another account in the app. */
export async function sendTransfer(input: CreateTransferInput): Promise<PaymentReceipt> {
  const { data } = await api.post('/wallet/transfers', input);
  return paymentReceiptSchema.parse(data);
}


export async function fetchReceipts(query: ReceiptQuery) { const {data} = await api.get('/wallet/receipts', {params: query}); return receivedPaymentsSchema.parse(data).receipts; }
