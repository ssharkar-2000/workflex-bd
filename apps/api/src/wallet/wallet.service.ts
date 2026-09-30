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
      // Only money earned from work can leave the wallet — see withdraw().
      // Money already asked for is out of both figures from the moment it is
      // requested, so this needs no further subtraction.
      withdrawable: wallet?.withdrawable ?? 0,
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: STATEMENT_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        topUp: { select: { method: true } },
        payment: {
          include: { payer: { select: NAME }, payee: { select: NAME } },
        },
        withdrawal: true,
      },
    });

    const page = rows.slice(0, STATEMENT_PAGE);
    const entries: WalletEntry[] = page.map((row) => {
      const payment = row.payment;
      const w = row.withdrawal;
      return {
        id: row.id,
        type: row.type,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        createdAt: row.createdAt.toISOString(),
        counterparty: payment
          ? displayName(row.type === 'PAYMENT_SENT' ? payment.payee : payment.payer)
          : null,
        jobTitle: payment?.jobTitle ?? null,
        note: payment?.note ?? null,
        topUpMethod: row.topUp?.method ?? null,
        withdrawal: w
          ? {
              id: w.id,
              method: w.method,
              account: maskAccount(w),
              status: w.status,
              reference: w.payoutReference,
              rejectReason: w.rejectReason,
            }
          : null,
      };
    });

    return {
      entries,
      nextCursor: rows.length > STATEMENT_PAGE ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * The people this account can pay: everyone accepted on one of its
   * postings, with what has been paid to each for that job so far.
   */
  async payees(userId: string): Promise<PayeeList> {
    const [rows, paid] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where: { status: 'ACCEPTED', job: { postedBy: userId } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          job: { select: { title: true } },
          user: { select: NAME },
        },
      }),
      this.prisma.walletPayment.groupBy({
        by: ['jobId', 'payeeId'],
        where: { payerId: userId },
        _sum: { amount: true },
      }),
    ]);

    const paidByHire = new Map(
      paid.map((row) => [`${row.jobId}:${row.payeeId}`, row._sum.amount ?? 0]),
    );

    return {
      payees: rows.map((row) => ({
        jobId: row.jobId,
        jobTitle: row.job.title,
        payeeId: row.userId,
        name: displayName(row.user),
        phone: row.user.phone,
        paidSoFar: paidByHire.get(`${row.jobId}:${row.userId}`) ?? 0,
        hiredAt: row.updatedAt.toISOString(),
      })),
    };
  }

  // --- moving money ---

  /**
   * Paying someone hired on one of your postings.
   *
   * Only an accepted applicant on a job this account posted can be paid.
   * Anything looser — paying any account by number — would make the wallet a
   * general money-transfer service, which is a licensed activity in its own
   * right and not what this product is.
   */
  async pay(payerId: string, dto: CreatePaymentDto): Promise<PaymentReceipt> {
    const repeat = await this.paymentByRequest(payerId, dto.requestId);
    if (repeat) return repeat;

    if (dto.payeeId === payerId) throw this.notHired();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const hire = await tx.jobApplication.findUnique({
          where: { jobId_userId: { jobId: dto.jobId, userId: dto.payeeId } },
          include: {
            job: { select: { title: true, postedBy: true } },
            user: { select: NAME },
          },
        });
        if (!hire || hire.job.postedBy !== payerId || hire.status !== 'ACCEPTED') {
          throw this.notHired();
        }

        // Locked in a fixed order, so two people paying each other at the
        // same moment cannot each hold one lock and wait for the other.
        const [first, second] = [payerId, dto.payeeId].sort();
        const locks = new Map<string, LockedWallet>();
        locks.set(first!, await this.lock(tx, first!));
        locks.set(second!, await this.lock(tx, second!));
        const payer = locks.get(payerId)!;
        const payee = locks.get(dto.payeeId)!;

        // See transfer(): a first copy of this request may have committed
        // while this one waited for the locks.
        const retried = await this.paymentByRequest(payerId, dto.requestId);
        if (retried) return retried;

        if (payer.balance < dto.amount) {
          throw new AppException(
            ApiErrorCode.INSUFFICIENT_BALANCE,
            'Not enough money in the wallet for this payment',
            HttpStatus.CONFLICT,
            { balance: payer.balance },
          );
        }

        const payment = await tx.walletPayment.create({
          data: {
            payerId,
            payeeId: dto.payeeId,
            jobId: dto.jobId,
            jobTitle: hire.job.title,
            amount: dto.amount,
            note: dto.note?.trim() ? dto.note.trim() : null,
            requestId: dto.requestId,
          },
        });

        // Spent from money that was added before money that was earned, so
        // the earned part stays withdrawable for as long as possible.
        const remaining = payer.balance - dto.amount;
        const after = await this.post(
          tx,
          payer,
          {
            balance: -dto.amount,
            withdrawable: Math.min(payer.withdrawable, remaining) - payer.withdrawable,
          },
          { type: 'PAYMENT_SENT', paymentId: payment.id },
        );
        await this.post(
          tx,
          payee,
          { balance: dto.amount, withdrawable: dto.amount },
          { type: 'PAYMENT_RECEIVED', paymentId: payment.id },
        );

        this.logger.log(
          `Payment ${payment.id}: ${dto.amount} BDT from ${payerId} to ${dto.payeeId} for job ${dto.jobId}`,
        );

        return {
          id: payment.id,
          amount: payment.amount,
          payeeName: displayName(hire.user),
          jobId: payment.jobId,
          jobTitle: payment.jobTitle,
          balance: after.balance,
          createdAt: payment.createdAt.toISOString(),
        };
      });
    } catch (err) {
      // Two copies of one request raced past the lookup at the top. The
      // unique requestId let exactly one through; answer the other with it.
      if (isUniqueViolation(err)) {
        const winner = await this.paymentByRequest(payerId, dto.requestId);
        if (winner) return winner;
      }
      throw err;
    }
  }

  /**
   * Asking for earnings to be sent out.
   *
   * The money leaves the wallet now, not when the transfer is made, so it
   * cannot be spent twice while the request waits. Needs level 1: money
   * leaving the platform goes to a named person, and that name has to have
   * been checked against an NID.
   */
  async withdraw(userId: string, dto: CreateWithdrawalDto): Promise<WithdrawalDto> {
    const repeat = await this.withdrawalByRequest(userId, dto.requestId);
    if (repeat) return repeat;

    // Against the database, not the token: a revoked verification must stop
    // money going out immediately, not when the token expires.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verificationLevel: true },
    });
    if (!user) throw AppException.notFound('No such account');
    if (user.verificationLevel < 1) throw AppException.verificationRequired(1);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const wallet = await this.lock(tx, userId);

        // Only money earned from work may leave the platform. Money the
        // person added can pay for work and move between wallets, but not
        // come straight back out: topping up with someone else's money and
        // withdrawing it to your own bKash would otherwise take one step.
        if (wallet.withdrawable < dto.amount) {
          if (wallet.balance >= dto.amount) {
            throw new AppException(
              ApiErrorCode.NOT_WITHDRAWABLE,
              'Only money earned from work can be withdrawn',
              HttpStatus.CONFLICT,
              { withdrawable: wallet.withdrawable },
            );
          }
          throw new AppException(
            ApiErrorCode.INSUFFICIENT_BALANCE,
            'Not enough money in the wallet for this withdrawal',
            HttpStatus.CONFLICT,
            { balance: wallet.balance, withdrawable: wallet.withdrawable },
          );
        }

        const withdrawal = await tx.withdrawal.create({
          data: {
            userId,
            amount: dto.amount,
            method: dto.method,
            accountNumber: dto.accountNumber,
            accountName: dto.accountName,
            bankName: dto.method === 'BANK' ? dto.bankName : null,
            branchName: dto.method === 'BANK' ? dto.branchName : null,
            routingNumber:
              dto.method === 'BANK' && dto.routingNumber ? dto.routingNumber : null,
            requestId: dto.requestId,
          },
        });

        await this.post(
          tx,
          wallet,
          { balance: -dto.amount, withdrawable: -dto.amount },
          { type: 'WITHDRAWAL', withdrawalId: withdrawal.id },
        );

        this.logger.log(
          `Withdrawal ${withdrawal.id}: ${dto.amount} BDT requested by ${userId} to ${dto.method}`,
        );
        return this.toWithdrawal(withdrawal);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const winner = await this.withdrawalByRequest(userId, dto.requestId);
        if (winner) return winner;
      }
      throw err;
    }
  }

  /** Calling off a withdrawal nobody has sent yet. The money goes back. */
  async cancelWithdrawal(userId: string, id: string): Promise<WithdrawalDto> {
    return this.returnWithdrawal(id, { userId }, { status: 'CANCELLED' });
  }

  /**
   * An admin turning a withdrawal down. The money goes back into the wallet
   * and the reason is shown to the person on their statement.
   */
  async rejectWithdrawal(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<WithdrawalDto> {
    return this.returnWithdrawal(
      id,
      {},
      { status: 'REJECTED', rejectReason: reason, processedBy: adminId },
    );
  }

  /**
   * An admin recording that a withdrawal was sent. No money moves in the
   * ledger — it left the wallet when the request was made.
   */
  async markWithdrawalPaid(
    id: string,
    adminId: string,
    reference: string,
  ): Promise<WithdrawalDto> {
    const claimed = await this.prisma.withdrawal.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'PAID',
        payoutReference: reference,
        processedBy: adminId,
        processedAt: new Date(),
      },
    });
    if (claimed.count === 0) await this.explainUnclaimed(id);

    this.logger.log(`Withdrawal ${id} marked paid by ${adminId}`);
    return this.toWithdrawal(
      await this.prisma.withdrawal.findUniqueOrThrow({ where: { id } }),
    );
  }

  /**
   * Crediting a top-up the gateway confirmed.
   *
   * The status change and the credit are one transaction, and the status
   * change only happens from one of `from`. When the browser's return and the
   * gateway's IPN arrive together, both try; the second finds the status
   * already PAID, changes nothing, and so credits nothing. Returns whether
   * this call was the one that credited.
   */
  async creditTopUp(
    topUpId: string,
    from: TopUpStatus[],
    data: Prisma.TopUpUpdateManyMutationInput,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.topUp.updateMany({
        where: { id: topUpId, status: { in: from } },
        data: { ...data, status: 'PAID', completedAt: new Date() },
      });
      if (claimed.count === 0) return false;

      const topUp = await tx.topUp.findUniqueOrThrow({ where: { id: topUpId } });
      const wallet = await this.lock(tx, topUp.userId);
      // Spendable, not withdrawable: see the note on Wallet.withdrawable.
      await this.post(
        tx,
        wallet,
        { balance: topUp.amount, withdrawable: 0 },
        { type: 'TOP_UP', topUpId: topUp.id },
      );

      this.logger.log(`Top-up ${topUp.id}: ${topUp.amount} BDT credited to ${topUp.userId}`);
      return true;
    });
  }

  /**
   * What moved through this wallet over a span, for the insights screen.
   *
   * Grouped by kind of movement in SQL rather than in this process: a year of
   * a busy wallet is thousands of rows, and none of them are needed here — the
   * screen shows totals.
   *
   * Amounts are reported as magnitudes. The ledger signs them (money out is
   * negative), but a chart of "what did I spend" wants the size of each
   * slice, and the sign is already carried by which bucket it is in.
   */
  async insights(userId: string, range: InsightsRange): Promise<WalletInsights> {
    const since = startOf(range);

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!wallet) {
      return { range, since: since.toISOString(), income: 0, expense: 0, added: 0, slices: [] };
    }

    const grouped = await this.prisma.walletEntry.groupBy({
      by: ['type'],
      where: { walletId: wallet.id, createdAt: { gte: since } },
      _sum: { amount: true },
    });

    const totals = new Map<string, number>();
    for (const row of grouped) {
      totals.set(row.type, Math.abs(row._sum.amount ?? 0));
    }

    const take = (type: string) => totals.get(type) ?? 0;

    return {
      range,
      since: since.toISOString(),
      // Money another account paid in, and money returned from a withdrawal
      // that did not happen — both are the wallet gaining without the person
      // putting anything in.
      income: take('PAYMENT_RECEIVED') + take('WITHDRAWAL_RETURNED'),
      expense: take('PAYMENT_SENT') + take('WITHDRAWAL'),
      added: take('TOP_UP'),
      slices: [...totals]
        .filter(([, total]) => total > 0)
        .map(([type, total]) => ({ type: type as InsightsSliceType, total }))
        .sort((a, b) => b.total - a.total),
    };
  }

  /**
   * Money paid to the platform itself, not to another account — a
   * subscription today, anything else the product sells later.
   *
   * One debit and one ledger row, no counterparty: the platform is not an
   * account in this system, so there is nobody to credit. The row is typed
   * PAYMENT_SENT because that is what it is from the wallet's point of view,
   * and it carries no payment id, which is how a platform charge is told
   * apart from a payment to a person.
   */
  async chargeToPlatform(
    userId: string,
    charge: { amount: number; reason: string },
  ): Promise<{ id: string; balance: number }> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await this.lock(tx, userId);

      if (wallet.balance < charge.amount) {
        throw new AppException(
          ApiErrorCode.INSUFFICIENT_BALANCE,
          'Not enough money in the wallet',
          HttpStatus.CONFLICT,
          { balance: wallet.balance },
        );
      }

      const remaining = wallet.balance - charge.amount;
      const after = await this.post(
        tx,
        wallet,
        {
          balance: -charge.amount,
          // Added money is spent before earned money, as everywhere else.
          withdrawable: Math.min(wallet.withdrawable, remaining) - wallet.withdrawable,
        },
        { type: 'PAYMENT_SENT' },
      );

      const entry = await tx.walletEntry.findFirst({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      this.logger.log(
        `Platform charge: ${charge.amount} BDT from ${userId} — ${charge.reason}`,
      );

      return { id: entry!.id, balance: after.balance };
    });
  }

  // --- paying for a job, by hand ---

  /**
   * Pay someone for a job, identified by what the payer can see and type:
   * the other person's WorkFlex id, their phone number, and which job it is
   * for.
   *
   * All three are checked, and the id and phone number must belong to the
   * same account. One identifier alone is a single typo away from paying a
   * stranger; three that have to agree is not something anyone does by
   * accident.
   *
   * Unlike paying from the hired list, this does not require the recipient to
   * have applied to the job — the work may have been agreed anywhere — but
   * the job itself has to exist, so the receipt names something real.
   */
  async payForJob(payerId: string, dto: PayForJobDto): Promise<PaymentReceipt> {
    const repeat = await this.paymentByRequest(payerId, dto.requestId);
    if (repeat) return repeat;

    const phone = (() => {
      try {
        return normalizeBdPhone(dto.phone);
      } catch {
        return null;
      }
    })();
    if (!phone) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That does not look like a Bangladeshi phone number',
        HttpStatus.BAD_REQUEST,
      );
    }

    const payee = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, publicId: true, ...NAME },
    });
    if (!payee || payee.publicId.toUpperCase() !== dto.publicId.trim().toUpperCase()) {
      // Deliberately one message for both: telling a payer which half of the
      // pair was wrong turns this into a way to test whether an id and a
      // number belong together.
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No account matches that WorkFlex id and phone number',
        HttpStatus.NOT_FOUND,
      );
    }
    if (payee.id === payerId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That is your own account',
        HttpStatus.BAD_REQUEST,
      );
    }

    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, title: true },
    });
    if (!job) {
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No job with that id',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [first, second] = [payerId, payee.id].sort();
        const locks = new Map<string, LockedWallet>();
        locks.set(first!, await this.lock(tx, first!));
        locks.set(second!, await this.lock(tx, second!));
        const payer = locks.get(payerId)!;
        const recipient = locks.get(payee.id)!;

        if (payer.balance < dto.amount) {
          throw new AppException(
            ApiErrorCode.INSUFFICIENT_BALANCE,
            'Not enough money in the wallet for this payment',
            HttpStatus.CONFLICT,
            { balance: payer.balance },
          );
        }

        const payment = await tx.walletPayment.create({
          data: {
            payerId,
            payeeId: payee.id,
            jobId: job.id,
            jobTitle: job.title,
            amount: dto.amount,
            note: dto.note && dto.note.trim() ? dto.note.trim() : null,
            requestId: dto.requestId,
          },
        });

        const remaining = payer.balance - dto.amount;
        const after = await this.post(
          tx,
          payer,
          {
            balance: -dto.amount,
            withdrawable: Math.min(payer.withdrawable, remaining) - payer.withdrawable,
          },
          { type: 'PAYMENT_SENT', paymentId: payment.id },
        );
        await this.post(
          tx,
          recipient,
          { balance: dto.amount, withdrawable: dto.amount },
          { type: 'PAYMENT_RECEIVED', paymentId: payment.id },
        );

        this.logger.log(
          `Job payment ${payment.id}: ${dto.amount} BDT from ${payerId} to ${payee.id} for job ${job.id}`,
        );

        return {
          id: payment.id,
          amount: payment.amount,
          payeeName: displayName(payee),
          jobId: job.id,
          jobTitle: job.title,
          balance: after.balance,
          createdAt: payment.createdAt.toISOString(),
        };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const winner = await this.paymentByRequest(payerId, dto.requestId);
        if (winner) return winner;
      }
      throw err;
    }
  }

  /**
   * Money paid in since a given moment, for the app to announce.
   *
   * The app asks with the time it last showed something, so a payment is
   * announced once per device and nothing has to be marked as seen on the
   * server. Capped, because an app returning after a month should show the
   * latest few rather than a month of modals.
   */
  async receivedSince(userId: string, since: Date): Promise<ReceivedPayment[]> {
    const payments = await this.prisma.walletPayment.findMany({
      where: { payeeId: userId, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { payer: { select: { publicId: true, ...NAME } } },
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      jobId: payment.jobId,
      jobTitle: payment.jobTitle,
      senderName: displayName(payment.payer),
      senderPublicId: payment.payer.publicId,
      senderPhone: payment.payer.phone,
      note: payment.note,
      receivedAt: payment.createdAt.toISOString(),
    }));
  }

  // --- sending money to another account, including by QR ---

  /**
   * This wallet's own code, for someone else to scan or type.
   *
   * The QR carries a link rather than a bare id: a phone camera outside the
   * app shows something a person can read, and a scan can be told apart from
   * whatever other QR happens to be in frame. The short code beside it is for
   * reading out when a camera will not focus — it is not resolvable on its
   * own, which is deliberate: a six-character code that opened someone's
   * wallet would be worth guessing.
   */
  async code(userId: string): Promise<WalletCode> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: NAME,
    });
    return {
      code: shortCode(userId),
      payload: `${WALLET_QR_PREFIX}${userId}`,
      name: displayName(user),
    };
  }

  /**
   * Who a scanned code belongs to, so the sender sees a name before parting
   * with money. Accepts what the camera read, an account id, or a phone
   * number typed by hand.
   */
  async resolve(code: string): Promise<ResolvedWallet> {
    const trimmed = code.trim();
    const fromQr = trimmed.startsWith(WALLET_QR_PREFIX)
      ? trimmed.slice(WALLET_QR_PREFIX.length).split('&')[0]
      : null;
    const id = fromQr ?? (UUID.test(trimmed) ? trimmed : null);

    // Only an active member's wallet can be paid: not a suspended or deleted
    // account, and never an admin's — whose name this would otherwise show
    // to anyone who guessed the number.
    const payable = { status: 'ACTIVE', isAdmin: false } as const;

    let user = id
      ? await this.prisma.user.findFirst({
          where: { id, ...payable },
          select: { id: true, ...NAME },
        })
      : null;

    if (!user) {
      // Not an id, so try it as a phone number — normalising first, because
      // people write the same number a dozen ways.
      let phone: string | null = null;
      try {
        phone = normalizeBdPhone(trimmed);
      } catch {
        phone = null;
      }
      if (phone) {
        user = await this.prisma.user.findFirst({
          where: { phone, ...payable },
          select: { id: true, ...NAME },
        });
      }
    }

    if (!user) {
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No WorkFlex account for that code',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      userId: user.id,
      code: shortCode(user.id),
      name: displayName(user),
      phone: maskPhone(user.phone),
    };
  }

  /**
   * Send money to another account in the app.
   *
   * The same ledger rules as paying someone hired — both wallets locked in a
   * fixed order, spendable money spent before earned money — minus the job:
   * this is one person handing money to another, and the statement says so.
   *
   * Only the earned part of what is sent arrives withdrawable. Money the
   * sender added themselves stays spendable-only on the other side too —
   * otherwise sending it to a friend who withdraws it would undo the rule in
   * withdraw() in one step.
   */
  async transfer(payerId: string, dto: CreateTransferDto): Promise<PaymentReceipt> {
    const repeat = await this.paymentByRequest(payerId, dto.requestId);
    if (repeat) return repeat;

    // Against the database, not the token: a suspended account must stop
    // sending money at once, not when its token runs out.
    const sender = await this.prisma.user.findUnique({
      where: { id: payerId },
      select: { status: true },
    });
    if (!sender || sender.status !== 'ACTIVE') {
      throw AppException.notFound('No active sender account');
    }

    const payee = await this.resolve(dto.code);
    if (payee.userId === payerId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That is your own wallet',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [first, second] = [payerId, payee.userId].sort();
        const locks = new Map<string, LockedWallet>();
        locks.set(first!, await this.lock(tx, first!));
        locks.set(second!, await this.lock(tx, second!));
        const payer = locks.get(payerId)!;
        const recipient = locks.get(payee.userId)!;

        // The first copy of this request may have committed while this one
        // waited for the locks, spending the money checked for below. Answer
        // with that transfer rather than "not enough money".
        const retried = await this.paymentByRequest(payerId, dto.requestId);
        if (retried) return retried;

        if (payer.balance < dto.amount) {
          throw new AppException(
            ApiErrorCode.INSUFFICIENT_BALANCE,
            'Not enough money in the wallet for this transfer',
            HttpStatus.CONFLICT,
            { balance: payer.balance },
          );
        }

        const payment = await tx.walletPayment.create({
          data: {
            payerId,
            payeeId: payee.userId,
            jobId: null,
            jobTitle: null,
            amount: dto.amount,
            note: dto.note && dto.note.trim() ? dto.note.trim() : null,
            requestId: dto.requestId,
          },
        });

        // Added money is spent first, so only what this takes from the
        // earned part moves across as earned.
        const added = payer.balance - payer.withdrawable;
        const earned = Math.max(0, dto.amount - added);
        const after = await this.post(
          tx,
          payer,
          { balance: -dto.amount, withdrawable: earned === 0 ? 0 : -earned },
          { type: 'PAYMENT_SENT', paymentId: payment.id },
        );
        await this.post(
          tx,
          recipient,
          { balance: dto.amount, withdrawable: earned },
          { type: 'PAYMENT_RECEIVED', paymentId: payment.id },
        );

        this.logger.log(
          `Transfer ${payment.id}: ${dto.amount} BDT from ${payerId} to ${payee.userId}`,
        );

        return {
          id: payment.id,
          amount: payment.amount,
          payeeName: payee.name,
          jobId: null,
          jobTitle: null,
          balance: after.balance,
          createdAt: payment.createdAt.toISOString(),
        };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const winner = await this.paymentByRequest(payerId, dto.requestId);
        if (winner) return winner;
      }
      throw err;
    }
  }

  /** Whether any account has been published for people to send money to. */
  private hasDepositAccount(): boolean {
    return (
      Boolean(this.config.get('WALLET_DEPOSIT_BKASH', { infer: true })) ||
      Boolean(this.config.get('WALLET_DEPOSIT_NAGAD', { infer: true })) ||
      Boolean(this.config.get('WALLET_DEPOSIT_BANK', { infer: true }))
    );
  }

  // --- the ledger itself ---

  /**
   * The account's wallet, locked until the transaction ends. Created first if
   * this is the first time money has moved for it — ON CONFLICT rather than
   * check-then-insert, so two first payments at once cannot both create one.
   */
  private async lock(tx: Tx, userId: string): Promise<LockedWallet> {
    await tx.$executeRaw`
      INSERT INTO "wallets" ("id", "userId", "balance", "withdrawable", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${userId}::uuid, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO NOTHING`;
    const rows = await tx.$queryRaw<LockedWallet[]>`
      SELECT "id", "balance", "withdrawable" FROM "wallets"
      WHERE "userId" = ${userId}::uuid
      FOR UPDATE`;
    const wallet = rows[0];
    if (!wallet) throw new Error(`Wallet for ${userId} vanished inside its own transaction`);
    return wallet;
  }

  /** Applies one movement to a locked wallet and writes its ledger entry. */
  private async post(
    tx: Tx,
    wallet: LockedWallet,
    move: Movement,
    cause: {
      type: WalletEntryType;
      topUpId?: string;
      paymentId?: string;
      withdrawalId?: string;
    },
  ): Promise<LockedWallet> {
    const next: LockedWallet = {
      id: wallet.id,
      balance: wallet.balance + move.balance,
      withdrawable: wallet.withdrawable + move.withdrawable,
    };
    // The database enforces the same rule; checking here first turns a bug
    // into a readable error instead of a constraint name.
    if (next.balance < 0 || next.withdrawable < 0 || next.withdrawable > next.balance) {
      throw new Error(
        `Ledger rule broken on wallet ${wallet.id}: ${JSON.stringify({ wallet, move })}`,
      );
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: next.balance, withdrawable: next.withdrawable },
    });
    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: cause.type,
        amount: move.balance,
        balanceAfter: next.balance,
        topUpId: cause.topUpId,
        paymentId: cause.paymentId,
        withdrawalId: cause.withdrawalId,
      },
    });
    return next;
  }

  // --- helpers ---

  /** Cancels or rejects a pending withdrawal and puts the money back. */
  private async returnWithdrawal(
    id: string,
    owner: { userId?: string },
    data: Prisma.WithdrawalUpdateManyMutationInput & {
      status: 'CANCELLED' | 'REJECTED';
    },
  ): Promise<WithdrawalDto> {
    const done = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.withdrawal.updateMany({
        where: { id, status: 'PENDING', ...owner },
        data: { ...data, processedAt: new Date() },
      });
      if (claimed.count === 0) return null;

      const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
      const wallet = await this.lock(tx, withdrawal.userId);
      await this.post(
        tx,
        wallet,
        { balance: withdrawal.amount, withdrawable: withdrawal.amount },
        { type: 'WITHDRAWAL_RETURNED', withdrawalId: withdrawal.id },
      );
      return withdrawal;
    });

    if (!done) {
      // Someone else's, or not pending any more — told apart below.
      const exists = await this.prisma.withdrawal.findFirst({
        where: { id, ...owner },
        select: { id: true },
      });
      if (!exists) throw AppException.notFound('No such withdrawal');
      await this.explainUnclaimed(id);
    }

    this.logger.log(`Withdrawal ${id} ${data.status.toLowerCase()}; money returned`);
    return this.toWithdrawal(done!);
  }

  /** Why a pending-only change found nothing to change. Always throws. */
  private async explainUnclaimed(id: string): Promise<never> {
    const current = await this.prisma.withdrawal.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw AppException.notFound('No such withdrawal');
    throw new AppException(
      ApiErrorCode.ALREADY_PROCESSED,
      `This withdrawal is already ${current.status.toLowerCase()}`,
      HttpStatus.CONFLICT,
      { status: current.status },
    );
  }

  private async paymentByRequest(
    payerId: string,
    requestId: string,
  ): Promise<PaymentReceipt | null> {
    const payment = await this.prisma.walletPayment.findUnique({
      where: { requestId },
      include: { payee: { select: NAME } },
    });
    if (!payment) return null;
    // Someone else's key. Not revealed as such — it is simply not theirs.
    if (payment.payerId !== payerId) throw AppException.notFound('No such payment');

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: payerId },
      select: { balance: true },
    });
    return {
      id: payment.id,
      amount: payment.amount,
      payeeName: displayName(payment.payee),
      jobTitle: payment.jobTitle,
      balance: wallet?.balance ?? 0,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private async withdrawalByRequest(
    userId: string,
    requestId: string,
  ): Promise<WithdrawalDto | null> {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { requestId } });
    if (!withdrawal) return null;
    if (withdrawal.userId !== userId) throw AppException.notFound('No such withdrawal');
    return this.toWithdrawal(withdrawal);
  }

  private notHired(): AppException {
    return new AppException(
      ApiErrorCode.NOT_HIRED,
      'You can pay only someone you have hired for one of your postings',
      HttpStatus.FORBIDDEN,
    );
  }

  private toWithdrawal(w: Withdrawal): WithdrawalDto {
    return {
      id: w.id,
      amount: w.amount,
      method: w.method,
      accountName: w.accountName,
      accountNumber: w.accountNumber,
      bankName: w.bankName,
      branchName: w.branchName,
      status: w.status,
      reference: w.payoutReference,
      rejectReason: w.rejectReason,
      createdAt: w.createdAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "WF-3A9C1B" — short enough to read out, derived so nothing is stored. */
function shortCode(userId: string): string {
  return `WF-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

type InsightsSliceType = WalletInsights['slices'][number]['type'];

/** Midnight a day, week, month or year ago — the start of the span shown. */
function startOf(range: InsightsRange): Date {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  switch (range) {
    case 'D':
      return from;
    case 'W':
      from.setDate(from.getDate() - 6);
      return from;
    case 'M':
      from.setMonth(from.getMonth() - 1);
      return from;
    case 'Y':
      from.setFullYear(from.getFullYear() - 1);
      return from;
  }
}
