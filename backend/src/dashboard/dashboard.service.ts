import { Injectable } from '@nestjs/common';
import {
  AlertStatus,
  JobStatus,
  TransactionStatus,
  VerificationStatus,
  WorkerStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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

  /// Backs the Analytics screen: two series plus the four KPI tiles.
  async analytics() {
    const metrics = await this.prisma.dailyMetric.findMany({ orderBy: { date: 'asc' } });

    const byMonth = new Map<string, { revenue: number; workers: number }>();
    for (const m of metrics) {
      const key = m.date.toISOString().slice(0, 7);
      const entry = byMonth.get(key) ?? { revenue: 0, workers: 0 };
      entry.revenue += Number(m.revenue);
      entry.workers = Math.max(entry.workers, m.activeWorkers);
      byMonth.set(key, entry);
    }

    const [ratings, jobTotals, approvedJobs, hires] = await this.prisma.$transaction([
      this.prisma.worker.aggregate({ _avg: { rating: true }, _sum: { reviewCount: true } }),
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.APPROVED } }),
      this.prisma.jobApplication.findMany({
        where: { hiredAt: { not: null } },
        select: { appliedAt: true, hiredAt: true },
      }),
    ]);

    const avgHireDays =
      hires.length === 0
        ? 0
        : hires.reduce((sum, h) => sum + (h.hiredAt!.getTime() - h.appliedAt.getTime()), 0) /
          hires.length /
          864e5;

    return {
      revenueSeries: [...byMonth].map(([month, v]) => ({ month, total: v.revenue })),
      workerSeries: [...byMonth].map(([month, v]) => ({ month, total: v.workers })),
      platformRating: Math.round(Number(ratings._avg.rating ?? 0) * 10) / 10,
      reviewCount: ratings._sum.reviewCount ?? 0,
      jobFillRate: jobTotals === 0 ? 0 : Math.round((approvedJobs / jobTotals) * 1000) / 10,
      avgHireDays: Math.round(avgHireDays * 10) / 10,
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