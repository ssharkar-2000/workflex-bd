import { Injectable } from '@nestjs/common';
import {
  AlertStatus,
  JobStatus,
  TransactionStatus,
  VerificationStatus,
  WorkerStatus,
} from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /// The four "Overview" cards, the Worker Status breakdown, the live alert
  /// strip, and the recent notification list — served together, since the
  /// design paints them all on the first screen.
  async overview() {
    const [
      totalWorkers,
      employers,
      pendingVerify,
      revenue,
      statusRows,
      liveAlerts,
      notifications,
      unread,
    ] = await this.prisma.$transaction([
      this.prisma.worker.count(),
      this.prisma.employer.count(),
      this.prisma.verificationRequest.count({ where: { status: VerificationStatus.PENDING } }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.COMPLETED },
      }),
      this.prisma.worker.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.alert.findMany({
        where: { status: { not: AlertStatus.RESOLVED } },
        orderBy: { detectedAt: 'desc' },
        take: 4,
        include: { worker: { select: { fullName: true } } },
      }),
      this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.notification.count({ where: { read: false } }),
    ]);

    const counts = Object.fromEntries(
      (statusRows as any[]).map((r) => [r.status, r._count?._all ?? 0]),
    );
    const pct = (n: number) => (totalWorkers === 0 ? 0 : Math.round((n / totalWorkers) * 100));

    return {
      overview: {
        totalWorkers,
        totalRevenue: Number(revenue._sum.amount ?? 0n),
        employers,
        pendingVerify,
      },
      workerStatus: {
        verified: pct(counts[WorkerStatus.ACTIVE] ?? 0),
        pending: pct(counts[WorkerStatus.PENDING] ?? 0),
        rejected: pct(counts[WorkerStatus.REJECTED] ?? 0),
        suspended: pct(counts[WorkerStatus.SUSPENDED] ?? 0),
      },
      liveAlerts,
      notifications: { items: notifications, unread },
    };
  }

  /// Backs the Analytics screen: two series, the four KPI tiles, and the
  /// payments/refunds breakdown reachable from Payments → Full Analytics.
  ///
  /// Item-23 audit follow-up: `revenueSeries`/`workerSeries` previously came
  /// from the `DailyMetric` table, which is only ever written by the seed
  /// script (`prisma/seed.ts`) — nothing in the running app inserts new rows
  /// as real activity happens. In practice this meant the chart looked
  /// populated right after seeding and then never moved again, no matter
  /// how much real activity occurred. Replaced with two live queries:
  /// revenue reuses `PaymentsService.revenueSeries()` (the actual
  /// `transactions` table, correctly excluding refunds — see that file),
  /// and worker growth is now a real cumulative count of ACTIVE workers by
  /// month from the `Worker` table itself.
  async analytics() {
    const months = 6;
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [revenueSeries, activeWorkers, ratings, jobTotals, approvedJobs, hires, paymentsByStatus, refundsAgg, methodRows] =
      await Promise.all([
        this.payments.revenueSeries(months),
        this.prisma.worker.findMany({
          where: { status: WorkerStatus.ACTIVE },
          select: { joinedAt: true },
          orderBy: { joinedAt: 'asc' },
        }),
        this.prisma.worker.aggregate({ _avg: { rating: true }, _sum: { reviewCount: true } }),
        this.prisma.job.count(),
        this.prisma.job.count({ where: { status: JobStatus.APPROVED } }),
        this.prisma.jobApplication.findMany({
          where: { hiredAt: { not: null } },
          select: { appliedAt: true, hiredAt: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['status'],
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { status: 'asc' },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          _count: { _all: true },
          where: { type: 'REFUND' },
        }),
        this.prisma.transaction.groupBy({
          by: ['method'],
          _sum: { amount: true },
          _count: { _all: true },
          where: { status: TransactionStatus.COMPLETED },
          orderBy: { method: 'asc' },
        }),
      ]);

    // Cumulative active-worker count as of the end of each of the last N
    // months — a real growth curve built from `Worker.joinedAt`, no
    // snapshot table required.
    const monthKeys: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      monthKeys.push(d.toISOString().slice(0, 7));
    }
    const workerSeries = monthKeys.map((key) => {
      const [y, m] = key.split('-').map(Number);
      const monthEnd = new Date(y, m, 0, 23, 59, 59, 999); // last instant of that month
      const total = activeWorkers.filter((w) => w.joinedAt <= monthEnd).length;
      return { month: key, total };
    });

    const avgHireDays =
      hires.length === 0
        ? 0
        : hires.reduce((sum, h) => sum + (h.hiredAt!.getTime() - h.appliedAt.getTime()), 0) /
          hires.length /
          864e5;

    return {
      revenueSeries,
      workerSeries,
      platformRating: Math.round(Number(ratings._avg.rating ?? 0) * 10) / 10,
      reviewCount: ratings._sum.reviewCount ?? 0,
      jobFillRate: jobTotals === 0 ? 0 : Math.round((approvedJobs / jobTotals) * 1000) / 10,
      avgHireDays: Math.round(avgHireDays * 10) / 10,
      payments: {
        byStatus: (paymentsByStatus as any[]).map((r) => ({
          status: r.status,
          total: Number(r._sum.amount ?? 0n),
          count: r._count._all,
        })),
        byMethod: (methodRows as any[]).map((r) => ({
          method: r.method,
          total: Number(r._sum.amount ?? 0n),
          count: r._count._all,
        })),
        refunds: {
          total: Number(refundsAgg._sum.amount ?? 0n),
          count: refundsAgg._count._all,
        },
      },
    };
  }

  /// Badge counts on the "All Sections" menu.
  async menuBadges() {
    const [workers, newJobs, verifications, alerts, complaints, notifications] =
      await this.prisma.$transaction([
        this.prisma.worker.count(),
        this.prisma.job.count({ where: { status: JobStatus.PENDING } }),
        this.prisma.verificationRequest.count({ where: { status: VerificationStatus.PENDING } }),
        this.prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
        this.prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        this.prisma.notification.count({ where: { read: false } }),
      ]);

    return { workers, newJobs, verifications, alerts, complaints, notifications };
  }
}