import {
  depositInstructionsSchema,
  depositListSchema,
  depositSchema,
  payeeListSchema,
  paymentReceiptSchema,
  resolvedWalletSchema,
  walletCodeSchema,
  walletStatementSchema,
  walletSummarySchema,
  withdrawalSchema,
  type CreateDepositInput,
  type CreatePaymentInput,
  type CreateTransferInput,
  type CreateWithdrawalInput,
  type Deposit,
  type DepositInstructions,
  type PayeeList,
  type PaymentReceipt,
  type ResolvedWallet,
  type WalletCode,
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
