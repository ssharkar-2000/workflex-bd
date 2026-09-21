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
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const txn = await this.prisma.transaction.findUnique({
      where: { id },
      include: { worker: { select: { id: true, fullName: true, code: true } } },
    });
    if (!txn) throw new NotFoundException('That transaction no longer exists.');
    return txn;
  }

  /// The four cards at the top of the Payments screen.
  async summary() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, monthly, pending, fees] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.COMPLETED },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.COMPLETED, occurredAt: { gte: startOfMonth } },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.PENDING },
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
      pendingPayouts: num(pending._sum.amount),
    };
  }

  /// Monthly revenue series for the Revenue Analytics chart.
  async revenueSeries(months = 7) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ month: Date; total: bigint }[]>`
      SELECT date_trunc('month', "occurredAt") AS month, SUM(amount)::bigint AS total
      FROM transactions
      WHERE status = 'COMPLETED' AND "occurredAt" >= ${since}
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

    const count = await this.prisma.transaction.count();
    const refund = await this.prisma.transaction.create({
      data: {
        code: `TXN-${8825 + count + 1}`,
        type: TransactionType.REFUND,
        status: TransactionStatus.PENDING,
        amount: BigInt(amount),
        fromLabel: 'WorkFlex BD',
        toLabel: original.fromLabel,
        refundReason: reason,
        workerId: original.workerId,
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
