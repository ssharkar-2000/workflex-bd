import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Report } from '@prisma/client';
import {
  ApiErrorCode,
  type AdminReport,
  type AdminReportList,
  type CreateReportDto,
  type MyReport,
  type MyReportList,
  type ReportCategory,
  type ReportStatus,
  type ResolveReportDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/**
 * How many reports one account may have awaiting a first look.
 *
 * Not throttling for its own sake: a queue flooded by one person buries
 * everyone else's complaints, and the rate limiter cannot see that because
 * each submission is minutes apart and individually legitimate.
 */
const MAX_OPEN_PER_USER = 10;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the reported job's title for display.
   *
   * Looked up rather than stored: the title on screen should be the current
   * one. A deleted posting yields null, which the UI shows as "job no longer
   * listed" — the report itself survives, which is the point of not making
   * `targetJobId` a foreign key.
   */
  private async jobTitles(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();

    const jobs = await this.prisma.job.findMany({
      where: { id: { in: unique } },
      select: { id: true, title: true },
    });
    return new Map(jobs.map((j) => [j.id, j.title]));
  }

  private toMine(report: Report, jobTitle: string | null): MyReport {
    return {
      id: report.id,
      category: report.category,
      targetType: report.targetType,
      targetJobTitle: jobTitle,
      subject: report.subject,
      details: report.details,
      status: report.status,
      response: report.response,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
    };
  }

  async create(userId: string, dto: CreateReportDto): Promise<MyReport> {
    const open = await this.prisma.report.count({
      where: { reporterId: userId, status: { in: ['OPEN', 'IN_REVIEW'] } },
    });

    if (open >= MAX_OPEN_PER_USER) {
      throw new AppException(
        ApiErrorCode.TOO_MANY_OPEN_REPORTS,
        `Account already has ${open} reports awaiting review`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        category: dto.category,
        targetType: dto.targetType,
        targetJobId: dto.targetJobId ?? null,
        targetPhone: dto.targetPhone ?? null,
        subject: dto.subject,
        details: dto.details,
      },
    });

    // Logged at warn for the fraud-shaped categories so they surface in an
    // alert feed rather than only in a queue somebody has to remember to open.
    const urgent: ReportCategory[] = ['FRAUD', 'NON_PAYMENT', 'HARASSMENT'];
    const line = `Report ${report.id} (${report.category}) filed by ${userId}`;
    if (urgent.includes(report.category)) this.logger.warn(line);
    else this.logger.log(line);

    const titles = await this.jobTitles(
      report.targetJobId ? [report.targetJobId] : [],
    );
    return this.toMine(report, titles.get(report.targetJobId ?? '') ?? null);
  }

  async mine(userId: string): Promise<MyReportList> {
    const rows = await this.prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const titles = await this.jobTitles(
      rows.flatMap((r) => (r.targetJobId ? [r.targetJobId] : [])),
    );

    return {
      reports: rows.map((r) =>
        this.toMine(r, titles.get(r.targetJobId ?? '') ?? null),
      ),
    };
  }

  // --- admin ---

  async list(filter?: ReportStatus | 'ALL'): Promise<AdminReportList> {
    const where =
      filter && filter !== 'ALL' ? { status: filter } : {};

    const [rows, open, total, grouped] = await Promise.all([
      this.prisma.report.findMany({
        where,
        // Oldest first within the queue: a complaint that has waited longest
        // is the one most overdue, which a newest-first list would bury.
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        take: 100,
        include: {
          reporter: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
      }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.report.count(),
      this.prisma.report.groupBy({
        by: ['category'],
        _count: { _all: true },
        where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      }),
    ]);

    const titles = await this.jobTitles(
      rows.flatMap((r) => (r.targetJobId ? [r.targetJobId] : [])),
    );

    const reports: AdminReport[] = rows.map((r) => ({
      ...this.toMine(r, titles.get(r.targetJobId ?? '') ?? null),
      reporterName:
        [r.reporter?.firstName, r.reporter?.lastName]
          .filter(Boolean)
          .join(' ') || null,
      // A report outlives its reporter's account; say so rather than blank.
      reporterPhone: r.reporter?.phone ?? 'Deleted account',
      targetPhone: r.targetPhone,
      targetJobId: r.targetJobId,
    }));

    return {
      open,
      total,
      byCategory: Object.fromEntries(
        grouped.map((g) => [g.category, g._count._all]),
      ) as AdminReportList['byCategory'],
      reports,
    };
  }

  async resolve(
    id: string,
    adminId: string,
    dto: ResolveReportDto,
  ): Promise<AdminReport> {
    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('That report no longer exists');

    const ending = dto.status === 'ACTION_TAKEN' || dto.status === 'DISMISSED';

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        // Only overwrite the reply when one was actually written — moving a
        // report to IN_REVIEW should not erase an earlier note.
        ...(dto.response !== undefined ? { response: dto.response } : {}),
        reviewedBy: adminId,
        resolvedAt: ending ? (existing.resolvedAt ?? new Date()) : null,
      },
      include: {
        reporter: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    const titles = await this.jobTitles(
      updated.targetJobId ? [updated.targetJobId] : [],
    );

    return {
      ...this.toMine(updated, titles.get(updated.targetJobId ?? '') ?? null),
      reporterName:
        [updated.reporter?.firstName, updated.reporter?.lastName]
          .filter(Boolean)
          .join(' ') || null,
      reporterPhone: updated.reporter?.phone ?? 'Deleted account',
      targetPhone: updated.targetPhone,
      targetJobId: updated.targetJobId,
    };
  }
}
