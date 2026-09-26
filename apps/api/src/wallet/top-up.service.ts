import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type TopUpStatus,
  type WalletEntryType,
  type Withdrawal,
} from '@prisma/client';
import {
  ApiErrorCode,
  maskPhone,
  normalizeBdPhone,
  type InsightsRange,
  type PayForJobDto,
  type ReceivedPayment,
  type WalletInsights,
  WALLET_QR_PREFIX,
  type CreatePaymentDto,
  type CreateTransferDto,
  type ResolvedWallet,
  type WalletCode,
  type CreateWithdrawalDto,
  type PayeeList,
  type PaymentReceipt,
  type WalletEntry,
  type WalletStatement,
  type WalletSummary,
  type Withdrawal as WithdrawalDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';
import { PAYMENT_GATEWAY, type PaymentGateway } from './gateway/payment-gateway';

type Tx = Prisma.TransactionClient;

/** A wallet row, locked for the rest of the transaction that read it. */
interface LockedWallet {
  id: string;
  balance: number;
  withdrawable: number;
}

/** What one movement does to a wallet. */
interface Movement {
  balance: number;
  withdrawable: number;
}

const STATEMENT_PAGE = 30;

const NAME = { firstName: true, lastName: true, phone: true } as const;

/** A person's name as the other side of a payment sees it. */
export function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  phone: string;
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || maskPhone(user.phone);
}

/** Enough of an account number to recognise it, not enough to use it. */
function maskAccount(w: Pick<Withdrawal, 'method' | 'accountNumber'>): string {
  return w.method === 'BANK'
    ? `•••• ${w.accountNumber.slice(-4)}`
    : maskPhone(w.accountNumber);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * The wallet and its ledger.
 *
 * Every movement of money runs inside one database transaction that locks
 * the wallet rows it touches (SELECT … FOR UPDATE), checks the balance
 * against the locked row, updates it, and appends a ledger entry. Two
 * payments from the same wallet at the same instant therefore queue on the
 * lock instead of both reading the old balance and both succeeding; the
 * database's CHECK constraints (see the wallet migration) sit underneath as a
 * last line if a bug ever tried anyway.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway | null,
  ) {}

  // --- reading ---

  async summary(userId: string): Promise<WalletSummary> {
    const [wallet, user, pending] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { verificationLevel: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { userId, status: 'PENDING' },
        _sum: { amount: true },
      }),
    ]);
    if (!user) throw AppException.notFound('No such account');

    // Lifetime totals, read from the ledger rather than kept as counters:
    // every entry that ever moved money is still there, and a figure derived
    // from them cannot drift out of step with the balance.
    const [income, toppedUp] = wallet
      ? await Promise.all([
          this.prisma.walletEntry.aggregate({
            where: { walletId: wallet.id, type: 'PAYMENT_RECEIVED' },
            _sum: { amount: true },
          }),
          this.prisma.walletEntry.aggregate({
            where: { walletId: wallet.id, type: 'TOP_UP' },
            _sum: { amount: true },
          }),
        ])
      : [null, null];

    return {
      balance: wallet?.balance ?? 0,
      // Anything in the wallet may be withdrawn. Money already asked for is
      // out of `balance` from the moment it is requested, so this needs no
      // further subtraction.
      withdrawable: wallet?.balance ?? 0,
      pendingWithdrawals: pending._sum.amount ?? 0,
      income: income?._sum.amount ?? 0,
      toppedUp: toppedUp?._sum.amount ?? 0,
      canWithdraw: user.verificationLevel >= 1,
      canDeposit: this.hasDepositAccount(),
      gateway: this.gateway?.name ?? null,
    };
  }

  /** The ledger, newest first, a page at a time. */
  async statement(userId: string, cursor?: string): Promise<WalletStatement> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!wallet) return { entries: [], nextCursor: null };

    const rows = await this.prisma.walletEntry.findMany({
      where: { walletId: wallet.id },
      ord
