import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ApiErrorCode, SUBSCRIPTION_PLANS } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { displayName, initialsOf } from './console.mappers';

const DEFAULT_LIMIT = 20;

/**
 * The rest of the console: the people who hire, the money, the queues and
 * the screens that report on the platform.
 *
 * Every figure here is counted from this system's own tables. Where the
 * console asks for something this platform does not record — live alerts,
 * scheduled interviews, bans as their own objects — the endpoint answers
 * with an empty set rather than an error, so the screen renders its "nothing
 * here" state and says something true. See ConsoleController for which those
 * are and why.
 */
@Injectable()
export class ConsoleOperationsService {
  private readonly logger = new Logger(ConsoleOperationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- the people who hire ---

  async employers(params: { verified?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? DEFAULT_LIMIT));

    const where: Prisma.UserWhereInput = {
      isAdmin: false,
      OR: [{ company: { isNot: null } }, { accountType: 'COMPANY' }],
    };
    if (params.verified === 'true') where.verificationLevel = { gte: 1 };
    if (params.verified === 'false') where.verificationLevel = 0;
    if (params.search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: params.search, mode: 'insensitive' } },
            { lastName: { contains: params.search, mode: 'insensitive' } },
            { phone: { contains: params.search } },
            { company: { name: { contains: params.search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: EMPLOYER_SELECT,
      }),
    ]);

    return {
      items: rows.map((row) => this.toEmployer(row)),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async employerCounts() {
    const base: Prisma.UserWhereInput = {
      isAdmin: false,
      OR: [{ company: { isNot: null } }, { accountType: 'COMPANY' }],
    };
    const [total, verified] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, verificationLevel: { gte: 1 } } }),
    ]);
    return { total, verified, unverified: total - verified };
  }

  async employer(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: EMPLOYER_SELECT });
    if (!row) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such employer', HttpStatus.NOT_FOUND);
    }
    return this.toEmployer(row);
  }

  /** Registered companies, with who owns each and how much they post. */
  async companies(search?: string) {
    const rows = await this.prisma.company.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        _count: { select: { jobs: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        initials: initialsOf(row.name),
        industry: null,
        tradeLicenseNo: row.tradeLicenseNo,
        tin: row.tin,
        verified: row.verifiedAt !== null,
        jobs: row._count.jobs,
        createdAt: row.createdAt.toISOString(),
        owner: {
          id: row.owner.id,
          fullName: displayName(row.owner.firstName, row.owner.lastName, row.owner.phone),
          phone: row.owner.phone,
          email: row.owner.email,
        },
      })),
      meta: { total: rows.length, page: 1, limit: rows.length, pages: 1 },
    };
  }

  // --- identity checks ---

  /** The verification queue, grouped the way the console's tabs are. */
  async verificationsPendingByType() {
    const rows = await this.prisma.kycSubmission.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    const items = rows.map((row) => ({
      id: row.id,
      // This system checks one identity per account rather than a document
      // at a time, so every row is the same kind of check.
      type: row.accountType === 'COMPANY' ? 'BUSINESS' : 'NID',
      status: 'PENDING',
      subjectName: displayName(row.user.firstName, row.user.lastName, row.user.phone),
      documentUrl: null,
      reviewNote: null,
      submittedAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      counts: {
        NID: items.filter((row) => row.type === 'NID').length,
        BUSINESS: items.filter((row) => row.type === 'BUSINESS').length,
        FACE: 0,
        WORKER: 0,
        EMPLOYER: 0,
        COMPANY: 0,
      },
    };
  }

  /** Approve or reject one identity check. */
  async decideVerification(adminId: string, id: string, action: string, note?: string) {
    const status = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : null;
    if (!status) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        `Cannot ${action} a verification`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });
    if (!submission) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such submission', HttpStatus.NOT_FOUND);
    }

    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: {
          status,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectReason: status === 'REJECTED' ? (note ?? null) : null,
        },
      }),
      // Approving is what raises an account's level; a rejection leaves it
      // where it was rather than demoting a level earned elsewhere.
      ...(status === 'APPROVED'
        ? [
            this.prisma.user.update({
              where: { id: submission.userId },
              data: { verificationLevel: 1 },
            }),
          ]
        : []),
    ]);

    this.logger.log(`Verification ${id} ${status.toLowerCase()} by admin ${adminId}`);
    return { ok: true };
  }

  /** One person's documents, for the console's document viewer. */
  async documents(userId: string) {
    const rows = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        storageKey: true,
      },
    });

    return {
      ownerType: 'WORKER',
      total: rows.length,
      groups: [
        {
          jobId: null,
          job: null,
          documents: rows.map((row) => ({
            id: row.id,
            ownerType: 'WORKER',
            workerId: userId,
            employerId: null,
            jobId: null,
            kind: row.kind,
            fileName: `${row.kind}`,
            storageKey: row.storageKey,
            // Links are minted by the storage module against the reviewer's
            // own session, not handed out in a list.
            url: null,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            note: null,
            uploadedAt: row.createdAt.toISOString(),
          })),
        },
      ],
    };
  }

  // --- money ---

  async paymentsSummary() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [all, thisMonth, wallets, pending] = await Promise.all([
      this.prisma.walletPayment.aggregate({ _sum: { amount: true } }),
      this.prisma.walletPayment.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.withdrawal.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalRevenue: all._sum.amount ?? 0,
      monthlyRevenue: thisMonth._sum.amount ?? 0,
      walletBalance: wallets._sum.balance ?? 0,
      pendingPayouts: pending._sum.amount ?? 0,
    };
  }

  /** Six months of takings, oldest first. */
  async revenueSeries() {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const payments = await this.prisma.walletPayment.findMany({
      where: { createdAt: { gte: since } },
      select: { amount: true, createdAt: true },
    });

    const months = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const month = new Date(since);
      month.setMonth(since.getMonth() + i);
      months.set(monthKey(month), 0);
    }
    for (const payment of payments) {
      const key = monthKey(payment.createdAt);
      if (months.has(key)) months.set(key, (months.get(key) ?? 0) + payment.amount);
    }

    return [...months].map(([month, total]) => ({ month, total }));
  }

  /**
   * The transaction list, and one worker's transactions.
   *
   * Payments and withdrawals are two tables here; the console shows one
   * ledger, so they are merged and sorted together.
   */
  async transactions(params: { workerId?: string; page?: number; limit?: number }) {
    const limit = Math.min(100, Math.max(1, params.limit ?? DEFAULT_LIMIT));

    const [payments, withdrawals] = await Promise.all([
      this.prisma.walletPayment.findMany({
        where: params.workerId
          ? { OR: [{ payerId: params.workerId }, { payeeId: params.workerId }] }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          payer: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
          payee: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.withdrawal.findMany({
        where: params.workerId ? { userId: params.workerId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);

    const items = [
      ...payments.map((row) => ({
        id: row.id,
        code: row.id.slice(0, 8).toUpperCase(),
        type: 'SALARY_PAYMENT',
        status: 'COMPLETED',
        amount: row.amount,
        method: 'CASH',
        fromLabel: displayName(row.payer.firstName, row.payer.lastName, row.payer.phone),
        toLabel: displayName(row.payee.firstName, row.payee.lastName, row.payee.phone),
        failureReason: null,
        refundReason: null,
        occurredAt: row.createdAt.toISOString(),
        worker: {
          id: row.payee.id,
          code: row.payee.publicId,
          fullName: displayName(row.payee.firstName, row.payee.lastName, row.payee.phone),
        },
        job: row.jobId ? { id: row.jobId, title: row.jobTitle ?? '', code: '' } : null,
        direction: params.workerId
          ? row.payeeId === params.workerId
            ? ('IN' as const)
            : ('OUT' as const)
          : undefined,
      })),
      ...withdrawals.map((row) => ({
        id: row.id,
        code: row.id.slice(0, 8).toUpperCase(),
        type: 'WITHDRAWAL',
        status:
          row.status === 'PAID' ? 'COMPLETED' : row.status === 'PENDING' ? 'PENDING' : 'FAILED',
        amount: -row.amount,
        method: row.method,
        fromLabel: displayName(row.user.firstName, row.user.lastName, row.user.phone),
        toLabel: `${row.method} ${row.accountNumber}`,
        failureReason: row.rejectReason ?? null,
        refundReason: null,
        occurredAt: row.createdAt.toISOString(),
        worker: {
          id: row.user.id,
          code: row.user.publicId,
          fullName: displayName(row.user.firstName, row.user.lastName, row.user.phone),
        },
        job: null,
        direction: params.workerId ? ('OUT' as const) : undefined,
      })),
    ]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);

    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recent = items.filter((row) => row.occurredAt >= last30);

    return {
      items,
      meta: { total: items.length, page: 1, limit, pages: 1 },
      ...(params.workerId
        ? {
            last30Days: {
              cashIn: recent
                .filter((row) => row.direction === 'IN')
                .reduce((sum, row) => sum + Math.abs(row.amount), 0),
              cashOut: recent
                .filter((row) => row.direction === 'OUT')
                .reduce((sum, row) => sum + Math.abs(row.amount), 0),
            },
          }
        : {}),
    };
  }

  // --- work and attendance ---

  /** What today looks like across the platform. */
  async attendanceSummary() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [scheduled, checkedIn, completed, records] = await Promise.all([
      this.prisma.shift.count({ where: { startsAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.shift.count({
        where: { status: 'IN_PROGRESS', startsAt: { gte: dayStart, lt: dayEnd } },
      }),
      this.prisma.shift.count({
        where: { status: 'COMPLETED', startsAt: { gte: dayStart, lt: dayEnd } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { checkInAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { checkInAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
          shift: { select: { id: true, job: { select: { title: true } } } },
        },
      }),
    ]);

    return {
      today: { scheduled, checkedIn, completed, absent: Math.max(0, scheduled - checkedIn - completed) },
      items: records.map((row) => ({
        id: row.id,
        workerId: row.user.id,
        workerName: displayName(row.user.firstName, row.user.lastName, row.user.phone),
        workerCode: row.user.publicId,
        jobTitle: row.shift?.job.title ?? null,
        shiftId: row.shift?.id ?? null,
        checkInAt: row.checkInAt.toISOString(),
        checkOutAt: row.checkOutAt ? row.checkOutAt.toISOString() : null,
        status: row.checkOutAt ? 'COMPLETED' : 'CHECKED_IN',
      })),
    };
  }

  /** End a check-in from the console, when somebody forgot to. */
  async checkOut(id: string) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such record', HttpStatus.NOT_FOUND);
    }
    if (record.checkOutAt) return { ok: true, changed: false };

    await this.prisma.attendanceRecord.update({
      where: { id },
      data: { checkOutAt: new Date(), status: 'CHECKED_OUT' },
    });
    return { ok: true, changed: true };
  }

  // --- interviews ---

  /**
   * Meetings arranged between employers and candidates.
   *
   * The console's own vocabulary is narrower than this system's: it knows
   * nothing of a candidate having accepted or declined, so an accepted
   * interview reads as scheduled and a declined one as cancelled. The
   * underlying row keeps the distinction.
   */
  async interviews(filter?: string) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const where: Prisma.InterviewWhereInput =
      filter === 'TODAY'
        ? { scheduledAt: { gte: dayStart, lt: dayEnd } }
        : filter === 'UPCOMING'
          ? { scheduledAt: { gte: dayEnd }, status: { in: ['SCHEDULED', 'ACCEPTED', 'RESCHEDULED'] } }
          : filter === 'COMPLETED'
            ? { status: { in: ['COMPLETED', 'NO_SHOW'] } }
            : filter === 'CANCELLED'
              ? { status: { in: ['CANCELLED', 'DECLINED'] } }
              : {};

    const rows = await this.prisma.interview.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: 100,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            companyName: true,
            companyId: true,
          },
        },
        candidate: {
          select: {
            id: true,
            publicId: true,
            firstName: true,
            lastName: true,
            phone: true,
            cvProfile: { select: { titles: true } },
          },
        },
        employer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    return {
      items: rows.map((row) => {
        const candidateName = displayName(
          row.candidate.firstName,
          row.candidate.lastName,
          row.candidate.phone,
        );
        return {
          id: row.id,
          jobId: row.jobId,
          workerId: row.candidateId,
          applicationId: null,
          scheduledAt: row.scheduledAt.toISOString(),
          durationMinutes: row.durationMinutes,
          mode: row.mode,
          status: consoleStatus(row.status),
          location: row.location ?? row.meetingUrl,
          interviewerName:
            row.interviewerName ??
            displayName(row.employer.firstName, row.employer.lastName, row.employer.phone),
          notes: row.notes,
          outcome: row.outcome ?? row.declineReason ?? row.cancelReason,
          createdAt: row.createdAt.toISOString(),
          worker: {
            id: row.candidate.id,
            code: row.candidate.publicId,
            fullName: candidateName,
            initials: initialsOf(candidateName),
            profession: row.candidate.cvProfile?.titles[0] ?? '',
            phone: row.candidate.phone,
          },
          job: {
            id: row.job.id,
            title: row.job.title,
            code: row.job.id.slice(0, 8).toUpperCase(),
            location: row.job.location,
            company: {
              id: row.job.companyId ?? '',
              name: row.job.companyName,
              initials: initialsOf(row.job.companyName),
            },
          },
        };
      }),
      meta: { total: rows.length, page: 1, limit: rows.length, pages: 1 },
    };
  }

  async interviewCounts() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [all, upcoming, today, completed, cancelled] = await Promise.all([
      this.prisma.interview.count(),
      this.prisma.interview.count({
        where: {
          scheduledAt: { gte: dayEnd },
          status: { in: ['SCHEDULED', 'ACCEPTED', 'RESCHEDULED'] },
        },
      }),
      this.prisma.interview.count({ where: { scheduledAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.interview.count({ where: { status: { in: ['COMPLETED', 'NO_SHOW'] } } }),
      this.prisma.interview.count({ where: { status: { in: ['CANCELLED', 'DECLINED'] } } }),
    ]);

    return { all, upcoming, today, completed, cancelled };
  }

  /** Call a meeting off from the console, with the reason on the record. */
  async cancelInterview(adminId: string, id: string, reason?: string) {
    const row = await this.prisma.interview.findUnique({ where: { id }, select: { status: true } });
    if (!row) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such interview', HttpStatus.NOT_FOUND);
    }
    if (row.status === 'COMPLETED') {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'That interview has already happened',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.interview.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason?.trim() || 'Cancelled by an administrator',
      },
    });

    this.logger.log(`Interview ${id} cancelled by admin ${adminId}`);
    return { ok: true };
  }

  // --- reporting ---

  async subscriptionsSummary() {
    const rows = await this.prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    });

    const byPlan = { FREE: 0, BASIC: 0, PRO: 0 } as Record<string, number>;
    for (const row of rows) {
      // The console's three tiers, from this product's own three.
      const key = row.plan === 'MONTHLY' ? 'BASIC' : row.plan === 'YEARLY' ? 'PRO' : 'PRO';
      byPlan[key] = (byPlan[key] ?? 0) + row._count._all;
    }

    return {
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
      byPlan,
      prices: SUBSCRIPTION_PLANS,
    };
  }

  /** Sessions and suspensions, for the security screen. */
  async securityOverview() {
    const [sessions, suspended, admins] = await Promise.all([
      this.prisma.refreshToken.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.admin.count(),
    ]);
    return { activeSessions: sessions, suspendedAccounts: suspended, admins };
  }

  async securitySessions() {
    const rows = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.user.id,
        userCode: row.user.publicId,
        userName: displayName(row.user.firstName, row.user.lastName, row.user.phone),
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
      meta: { total: rows.length, page: 1, limit: rows.length, pages: 1 },
    };
  }

  /** Sign one person out of every device. */
  async revokeSessions(userId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Revoked ${result.count} sessions for ${userId} from the console`);
    return { ok: true, revoked: result.count };
  }

  async systemHealth() {
    const [users, jobs, shifts, wallets] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.job.count(),
      this.prisma.shift.count(),
      this.prisma.wallet.count(),
    ]);

    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      database: 'up',
      tables: { users, jobs, shifts, wallets },
      checkedAt: new Date().toISOString(),
    };
  }

  private toEmployer(row: EmployerRow) {
    return {
      id: row.id,
      code: row.publicId,
      fullName: displayName(row.firstName, row.lastName, row.phone),
      email: row.email ?? '',
      phone: row.phone,
      verified: row.verificationLevel >= 1,
      company: row.company
        ? {
            id: row.company.id,
            name: row.company.name,
            initials: initialsOf(row.company.name),
          }
        : null,
    };
  }
}

const EMPLOYER_SELECT = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  verificationLevel: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

type EmployerRow = Prisma.UserGetPayload<{ select: typeof EMPLOYER_SELECT }>;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The console knows five interview states; this system keeps seven. */
function consoleStatus(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'SCHEDULED';
    case 'DECLINED':
      return 'CANCELLED';
    case 'RESCHEDULED':
      return 'RESCHEDULED';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'NO_SHOW':
      return 'NO_SHOW';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'SCHEDULED';
  }
}
