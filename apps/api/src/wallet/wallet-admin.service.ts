import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  TopUpStatus,
  WithdrawalStatus,
} from '@prisma/client';
import {
  ApiErrorCode,
  type AdminTopUpList,
  type AdminWalletSummary,
  type AdminWithdrawalList,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.schema';
import { AppException } from '../common/exceptions/app.exception';
import { WalletService } from './wallet.service';

const DAY_MS = 86_400_000;
const LIST_LIMIT = 100;

const USER = { firstName: true, lastName: true, phone: true } as const;

function nameOf(user: { firstName: string | null; lastName: string | null }): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

/**
 * The console's view of the wallet: the withdrawal queue, payments the
 * gateway flagged, and the totals a finance check starts from.
 *
 * Moving money stays in WalletService, so the ledger rules live in one
 * place; this service decides what an admin may see and asks it to act.
 */
@Injectable()
export class WalletAdminService {
  private readonly logger = new Logger(WalletAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Whether people have anywhere to send money to. */
  private hasDepositAccount(): boolean {
    return (
      Boolean(this.config.get('WALLET_DEPOSIT_BKASH', { infer: true })) ||
      Boolean(this.config.get('WALLET_DEPOSIT_NAGAD', { infer: true })) ||
      Boolean(this.config.get('WALLET_DEPOSIT_BANK', { infer: true }))
    );
  }

  async summary(): Promise<AdminWalletSummary> {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [wallets, pending, held, topUps, payments, paidOut] = await Promise.all([
      this.prisma.wallet.aggregate({ _sum: { balance: true, withdrawable: true } }),
      this.prisma.withdrawal.aggregate({
        where: { status: 'PENDING' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.topUp.count({ where: { status: 'HELD' } }),
      this.prisma.topUp.aggregate({
        where: { status: 'PAID', completedAt: { gte: since } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.walletPayment.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { status: 'PAID', processedAt: { gte: since } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      canDeposit: this.hasDepositAccount(),
      heldInWallets: wallets._sum.balance ?? 0,
      withdrawableInWallets: wallets._sum.withdrawable ?? 0,
      pendingWithdrawals: {
        count: pending._count._all,
        total: pending._sum.amount ?? 0,
      },
      heldTopUps: held,
      last30Days: {
        topUps: { count: topUps._count._all, total: topUps._sum.amount ?? 0 },
        payments: { count: payments._count._all, total: payments._sum.amount ?? 0 },
        withdrawalsPaid: { count: paidOut._count._all, total: paidOut._sum.amount ?? 0 },
      },
    };
  }

  /**
   * Withdrawals, pending ones oldest first — the queue is worked in the order
   * people asked, so nobody waits behind a later request.
   */
  async withdrawals(status?: WithdrawalStatus): Promise<AdminWithdrawalList> {
    const rows = await this.prisma.withdrawal.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: LIST_LIMIT,
      include: { user: { select: USER } },
    });

    return {
      withdrawals: rows.map((w) => ({
        id: w.id,
        userId: w.userId,
        userName: nameOf(w.user),
        userPhone: w.user.phone,
        amount: w.amount,
        method: w.method,
        accountName: w.accountName,
        accountNumber: w.accountNumber,
        bankName: w.bankName,
        branchName: w.branchName,
        routingNumber: w.routingNumber,
        status: w.status,
        reference: w.payoutReference,
        rejectReason: w.rejectReason,
        createdAt: w.createdAt.toISOString(),
        processedAt: w.processedAt?.toISOString() ?? null,
      })),
    };
  }

  /** Top-ups, held ones oldest first for the same reason as withdrawals. */
  async topUps(status?: TopUpStatus): Promise<AdminTopUpList> {
    const rows = await this.prisma.topUp.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: status === 'HELD' ? 'asc' : 'desc' },
      take: LIST_LIMIT,
      include: { user: { select: USER } },
    });

    return {
      topUps: rows.map((t) => ({
        id: t.id,
        userId: t.userId,
        userName: nameOf(t.user),
        userPhone: t.user.phone,
