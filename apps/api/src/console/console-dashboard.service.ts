import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { isoDate } from './console.mappers';

/** How many months of takings the dashboard's chart shows. */
const REVENUE_MONTHS = 6;
/** Notices shown under the dashboard's figures. */
const RECENT_NOTICES = 5;

/**
 * The console's home screen, and the badges on its menu.
 *
 * Every figure is counted from this system's own tables. The console's old
 * backend also had alerts (SOS calls, suspicious logins) and a table of them;
 * nothing here raises those, so that list comes back empty rather than
 * populated with something invented.
 */
@Injectable()
export class ConsoleDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      totalWorkers,
      employers,
      pendingVerify,
      verified,
      rejected,
      suspended,
      revenue,
      notices,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isAdmin: false } }),
      this.prisma.user.count({
        where: { isAdmin: false, OR: [{ company: { isNot: null } }, { accountType: 'COMPANY' }] },
      }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.user.count({
        where: { isAdmin: false, kycSubmissions: { some: { status: 'APPROVED' } } },
      }),
      this.prisma.user.count({
        where: { isAdmin: false, kycSubmissions: { some: { status: 'REJECTED' } } },
      }),
      this.prisma.user.count({ where: { isAdmin: false, status: { in: ['SUSPENDED', 'DELETED'] } } }),
      this.prisma.walletPayment.aggregate({ _sum: { amount: true } }),
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_NOTICES,
        include: { _count: { select: { reads: true } } },
      }),
    ]);

    const pending = Math.max(0, totalWorkers - verified - rejected - suspended);

    return {
      overview: {
        totalWorkers,
        totalRevenue: revenue._sum.amount ?? 0,
        employers,
        pendingVerify,
      },
      workerStatus: { verified, pending, rejected, suspended },
      // Nothing in this system raises alerts yet.
      liveAlerts: [],
      notifications: {
        items: notices.map((notice) => ({
          id: notice.id,
          kind: 'GENERAL' as const,
          title: notice.title,
          body: notice.body,
          read: notice._count.reads > 0,
          createdAt: isoDate(notice.createdAt) ?? '',
        })),
        unread: notices.filter((notice) => notice._count.reads === 0).length,
      },
    };
  }

  /**
   * Takings by month, oldest first. Grouped in this process rather than in
   * SQL: six months of payments is a small set, and doing it here keeps the
   * query portable across the databases this runs on.
   */
  async analytics() {
    const since = new Date();
    since.setMonth(since.getMonth() - (REVENUE_MONTHS - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const payments = await this.prisma.walletPayment.findMany({
      where: { createdAt: { gte: since } },
      select: { amount: true, createdAt: true },
    });

    const totals = new Map<string, number>();
    for (let i = 0; i < REVENUE_MONTHS; i++) {
      const month = new Date(since);
      month.setMonth(since.getMonth() + i);
      totals.set(monthKey(month), 0);
    }
    for (const payment of payments) {
      const key = monthKey(payment.createdAt);
      if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + payment.amount);
    }

    return {
      revenueSeries: [...totals].map(([month, total]) => ({ month, total })),
    };
  }

  /** The red numbers on the menu: what is waiting for someone. */
  async menuBadges() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [workers, newJobs, verifications, complaints, notifications] =
      await Promise.all([
        this.prisma.user.count({
          where: { isAdmin: false, createdAt: { gte: dayAgo } },
        }),
        this.prisma.job.count({ where: { createdAt: { gte: dayAgo } } }),
        this.prisma.kycSubmission.count({ where: { status: 'PENDING_REVIEW' } }),
        this.prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
        this.prisma.notification.count({ where: { createdAt: { gte: dayAgo } } }),
      ]);

    return { workers, newJobs, verifications, alerts: 0, complaints, notifications };
  }
}

/** `2026-09`, the key the console's chart labels months by. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
