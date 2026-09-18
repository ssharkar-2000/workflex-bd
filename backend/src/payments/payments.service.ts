import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListTransactionsDto) {
    const where: Prisma.TransactionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.workerId ? { workerId: query.workerId } : {}),
      ...(query.employerId ? { employerId: query.employerId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { fromLabel: { contains: query.search, mode: 'insensitive' } },
              { toLabel: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: query.sort ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { job: { select: { id: true, title: true, code: true } } },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    // Cash-in vs cash-out only makes sense relative to a single wallet, so
    // this is only computed when the caller asked for one worker's history
    // (e.g. the Worker Profile "all transactions" screen).
    const cashInTypes: TransactionType[] = [TransactionType.SALARY_PAYMENT, TransactionType.REFUND];
    const withDirection = items.map((item) => ({
      ...item,
      direction: query.workerId ? (cashInTypes.includes(item.type) ? 'IN' : 'OUT') : undefined,
    }));

    const page = paginate(withDirection, total, query.page, query.limit);

    if (!query.workerId) return page;

    // Extra summary block for the per-worker view: how much moved in/out in
    // the last 30 days, so the screen can show "cash-in/cash-out, last month"
    // without the app having to walk every row on the client.
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [cashIn, cashOut] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          workerId: query.workerId,
          status: TransactionStatus.COMPLETED,
          type: { in: cashInTypes },
          occurredAt: { gte: since },
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          workerId: query.workerId,
          status: TransactionStatus.COMPLETED,
          type: { in: [TransactionType.WITHDRAWAL, TransactionType.PLATFORM_FEE] },
          occurredAt: { gte: since },
        },
      }),
    ]);
    const num = (v: bigint | null) => Number(v ?? 0n);
    return {
      ...page,
      last30Days: { cashIn: num(cashIn._sum.amount), cashOut: num(cashOut._sum.amount) },
    };
  }

  async findOne(id: string) {
    const txn = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        worker: { select: { id: true, fullName: true, code: true } },
        relatedTransaction: { select: { id: true, code: true, amount: true } },
        refunds: { select: { id: true, code: true, amount: true, status: true } },
      },
    });
    if (!txn) throw new NotFoundException('That transaction no longer exists.');
    return txn;
  }

  /// The four cards at the top of the Payments screen.
  ///
  /// Two correctness fixes here (found during the item-23 CRUD/DB audit):
  /// 1. `totalRevenue`/`monthlyRevenue` previously summed *all* COMPLETED
  ///    transactions, which double-counts money leaving the platform:
  ///    a COMPLETED `REFUND` row was being added to revenue instead of
  ///    being excluded. Revenue now only counts money actually earned
  ///    (salary payments + platform fees), matching what "Total Revenue"
  ///    means on the Payments screen.
  /// 2. `pendingPayouts` previously summed *any* PENDING transaction
  ///    (including e.g. a pending refund or pending fee) — narrowed to
  ///    PENDING `WITHDRAWAL` rows, which is what "Pending Payouts" means.
  async summary() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const revenueTypes = [TransactionType.SALARY_PAYMENT, TransactionType.PLATFORM_FEE];

    const [total, monthly, pendingPayouts, fees] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.COMPLETED, type: { in: revenueTypes } },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: TransactionStatus.COMPLETED,
          type: { in: revenueTypes },
          occurredAt: { gte: startOfMonth },
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.PENDING, type: TransactionType.WITHDRAWAL },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.COMPLETED, type: TransactionType.PLATFORM_FEE },
      }),
    ]);

    const num = (v: bigint | null) => Number(v ?? 0n);
    return {
      totalRevenue: num(total._sum.amount),
      monthlyRevenue: num(monthly._sum.amount),
      // Fees collected but not yet swept out are what sits in the platform wallet.
      walletBalance: num(fees._sum.amount),
      pendingPayouts: num(pendingPayouts._sum.amount),
    };
  }

  /// Monthly revenue series for the Revenue Analytics chart.
  /// Same refund-exclusion fix as `summary()` above — see its docblock.
  async revenueSeries(months = 7) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ month: Date; total: bigint }[]>`
      SELECT date_trunc('month', "occurredAt") AS month, SUM(amount)::bigint AS total
      FROM transactions
      WHERE status = 'COMPLETED'
        AND type IN ('SALARY_PAYMENT', 'PLATFORM_FEE')
        AND "occurredAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      total: Number(r.total),
    }));
  }

  async refund(id: string, amount: number, reason: string, adminId: string) {
    const original = await this.findOne(id);
    if (original.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException('Only completed transactions can be refunded.');
    }
    if (BigInt(amount) > original.amount) {
      throw new BadRequestException('Refund cannot exceed the original amount.');
    }
    const alreadyRefunded = original.refunds.some((r) => r.status !== 'FAILED');
    if (alreadyRefunded) {
      throw new BadRequestException('A refund has already been issued for this transaction.');
    }

    // Same "count() + 1" collision bug fixed elsewhere (JobsService,
    // EmployersService) — deriving from the highest code in use instead of a
    // raw count survives gaps if a transaction row is ever removed.
    const code = await this.nextTransactionCode();
    const refund = await this.prisma.transaction.create({
      data: {
        code,
        type: TransactionType.REFUND,
        status: TransactionStatus.PENDING,
        amount: BigInt(amount),
        method: original.method,
        fromLabel: 'WorkFlex BD',
        toLabel: original.fromLabel,
        refundReason: reason,
        workerId: original.workerId,
        jobId: original.jobId,
        relatedTransactionId: original.id,
      },
    });

    await this.audit.record({
      adminId,
      action: 'transaction.refund',
      entityType: 'Transaction',
      entityId: original.id,
      reason,
      metadata: { refundId: refund.id, amount },
    });
    return refund;
  }

  private async nextTransactionCode(): Promise<string> {
    const last = await this.prisma.transaction.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? Number(last.code.split('-')[1]) : 8825;
    const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 8826;
    return `TXN-${nextNumber}`;
  }

  async retry(id: string, adminId: string) {
    const txn = await this.findOne(id);
    if (txn.status !== TransactionStatus.FAILED) {
      throw new BadRequestException('Only failed transactions can be retried.');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status: TransactionStatus.PENDING, failureReason: null },
    });
    await this.audit.record({
      adminId,
      action: 'transaction.retry',
      entityType: 'Transaction',
      entityId: id,
    });
    return updated;
  }
}
