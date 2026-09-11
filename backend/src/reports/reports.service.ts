import { Injectable } from '@nestjs/common';
import { JobStatus, TransactionStatus, VerificationStatus, WorkerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Range = { from: Date; to: Date };

/// Defaults to the last 30 days when the caller gives no window.
function resolveRange(from?: string, to?: string): Range {
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 864e5);
  start.setHours(0, 0, 0, 0);
  return { from: start, to: end };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /// One report bundle covering the sections an admin would export: workforce,
  /// hiring, money, and trust & safety.
  async summary(from?: string, to?: string) {
    const range = resolveRange(from, to);
    const window = { gte: range.from, lte: range.to };

    const [
      workersByStatus,
      newWorkers,
      jobsByStatus,
      newJobs,
      hires,
      revenue,
      refunds,
      failed,
      verificationsByStatus,
      alertsBySeverity,
      complaintsResolved,
    ] = await this.prisma.$transaction([
      this.prisma.worker.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.worker.count({ where: { createdAt: window } }),
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.job.count({ where: { postedAt: window } }),
      this.prisma.jobApplication.count({ where: { hiredAt: window } }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: { status: TransactionStatus.COMPLETED, occurredAt: window },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'REFUND', occurredAt: window },
      }),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.FAILED, occurredAt: window },
      }),
      this.prisma.verificationRequest.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.alert.groupBy({ by: ['severity'], _count: { _all: true }, orderBy: { severity: 'asc' } }),
      this.prisma.complaint.count({ where: { resolvedAt: window } }),
    ]);

    const tally = (rows: any[], key: string, value: string) =>
      rows.find((r) => r[key] === value)?._count?._all ?? 0;

    return {
      range: {
        from: range.from.toISOString().slice(0, 10),
        to: range.to.toISOString().slice(0, 10),
      },
      workforce: {
        total: (workersByStatus as any[]).reduce((sum, r: any) => sum + (r._count?._all ?? 0), 0),
        active: tally(workersByStatus, 'status', WorkerStatus.ACTIVE),
        pending: tally(workersByStatus, 'status', WorkerStatus.PENDING),
        suspended: tally(workersByStatus, 'status', WorkerStatus.SUSPENDED),
        newInPeriod: newWorkers,
      },
      hiring: {
        totalJobs: (jobsByStatus as any[]).reduce((sum, r: any) => sum + (r._count?._all ?? 0), 0),
        approved: tally(jobsByStatus, 'status', JobStatus.APPROVED),
        pending: tally(jobsByStatus, 'status', JobStatus.PENDING),
        rejected: tally(jobsByStatus, 'status', JobStatus.REJECTED),
        postedInPeriod: newJobs,
        hiresInPeriod: hires,
      },
      money: {
        revenue: Number(revenue._sum.amount ?? 0n),
        transactionCount: revenue._count._all,
        refunded: Number(refunds._sum.amount ?? 0n),
        failedCount: failed,
      },
      trustAndSafety: {
        verificationsApproved: tally(verificationsByStatus, 'status', VerificationStatus.APPROVED),
        verificationsPending: tally(verificationsByStatus, 'status', VerificationStatus.PENDING),
        criticalAlerts: tally(alertsBySeverity, 'severity', 'CRITICAL'),
        highAlerts: tally(alertsBySeverity, 'severity', 'HIGH'),
        complaintsResolvedInPeriod: complaintsResolved,
      },
    };
  }

  /// CSV export. Returned as a string so the controller can set the header and
  /// the client can share or save it.
  async transactionsCsv(from?: string, to?: string) {
    const range = resolveRange(from, to);
    const rows = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: range.from, lte: range.to } },
      orderBy: { occurredAt: 'desc' },
    });

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ['Reference', 'Type', 'Status', 'Amount (BDT)', 'From', 'To', 'Date'];
    const lines = rows.map((r) =>
      [
        r.code,
        r.type,
        r.status,
        (Number(r.amount) / 100).toFixed(2),
        r.fromLabel,
        r.toLabel,
        r.occurredAt.toISOString().slice(0, 10),
      ]
        .map((v) => escape(String(v)))
        .join(','),
    );

    return [header.map(escape).join(','), ...lines].join('\n');
  }
}