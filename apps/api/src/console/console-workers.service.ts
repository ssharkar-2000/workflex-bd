import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  displayName,
  initialsOf,
  isoDate,
  referenceCode,
  toPaisa,
  workerStatus,
  type ConsoleWorkerStatus,
} from './console.mappers';

/** What the console's list screens page by. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * The people the console calls "workers": every account on the platform.
 *
 * There is no separate worker table here — one account both looks for work
 * and hires — so the console's Workers screen lists accounts, and its
 * Employers screen (see the employers endpoints) lists the ones that have
 * posted a job or registered a company.
 */
@Injectable()
export class ConsoleWorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));

    const where: Prisma.UserWhereInput = { isAdmin: false };
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    Object.assign(where, statusFilter(params.status));

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: WORKER_INCLUDE,
      }),
    ]);

    return {
      items: rows.map((row) => this.toWorker(row)),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /**
   * The counts behind the filter tabs. Each is a separate query rather than
   * a group-by: the console's four tabs do not map to one column — suspended
   * comes from the account, the rest from the identity check.
   */
  async statusCounts() {
    const base: Prisma.UserWhereInput = { isAdmin: false };
    const [total, active, pending, suspended] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, ...statusFilter('ACTIVE') } }),
      this.prisma.user.count({ where: { ...base, ...statusFilter('PENDING') } }),
      this.prisma.user.count({ where: { ...base, ...statusFilter('SUSPENDED') } }),
    ]);
    return { total, active, pending, suspended };
  }

  async one(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: WORKER_INCLUDE,
    });
    if (!row) throw new NotFoundException('No such account');

    // The console calls it hired; this system marks the application
    // ACCEPTED, which is the same moment.
    const [hired, applications] = await Promise.all([
      this.prisma.jobApplication.count({
        where: { userId: id, status: 'ACCEPTED' },
      }),
      this.prisma.jobApplication.count({ where: { userId: id } }),
    ]);

    return {
      ...this.toWorker(row),
      totalJobs: hired,
      completionRate: applications ? Math.round((hired / applications) * 100) : 0,
      skills: (row.cvProfile?.skills ?? []).map((name) => ({ name })),
      certifications: [],
      jobHistory: [],
    };
  }

  /**
   * The jobs this account has been hired for.
   *
   * Hires, not applications: the console's history screen is about work that
   * happened, and an application that went nowhere is not history.
   */
  async jobHistory(id: string) {
    const rows = await this.prisma.jobApplication.findMany({
      where: { userId: id, status: 'ACCEPTED' },
      orderBy: { appliedAt: 'desc' },
      take: 50,
      include: { job: { select: { id: true, title: true, companyName: true } } },
    });

    return rows.map((row) => ({
      id: row.jobId,
      company: row.job.companyName,
      role: row.job.title,
      startedAt: row.appliedAt.toISOString(),
      // Nothing records when a hire ended; a shift is where that lives.
      endedAt: null,
    }));
  }

  /**
   * Suspend an account, restore it, or mark its identity checked.
   *
   * Rejecting is deliberately not an action on the account: an identity
   * check is rejected on the submission (see the verification endpoints),
   * which keeps the reason with the evidence.
   */
  async decide(id: string, action: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('No such account');

    switch (action) {
      case 'suspend':
        await this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
        break;
      case 'activate':
      case 'restore':
      case 'unsuspend':
        await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
        break;
      case 'approve':
      case 'verify':
        await this.prisma.user.update({ where: { id }, data: { verificationLevel: 1 } });
        break;
      default:
        return { ok: true, changed: false };
    }

    return { ok: true, changed: true };
  }

  private toWorker(row: WorkerRow) {
    const kyc = row.kycSubmissions[0]?.status ?? null;
    const name = displayName(row.firstName, row.lastName, row.phone);
    const cv = row.cvProfile;

    return {
      id: row.id,
      code: referenceCode('W', row.id),
      fullName: name,
      initials: initialsOf(name),
      profession: cv?.titles[0] ?? '',
      status: workerStatus(row.status, kyc) satisfies ConsoleWorkerStatus,
      // Not asked anywhere in this product, so not invented here.
      availability: null,
      phone: row.phone,
      email: row.email,
      address: row.address ?? '',
      bio: cv?.summary ?? null,
      education: null,
      lastCompany: null,
      experienceMonths: (cv?.yearsExperience ?? 0) * 12,
      rating: null,
      reviewCount: null,
      trustScore: row.verificationLevel * 33,
      totalJobs: 0,
      completionRate: 0,
      totalEarnings: toPaisa(row.wallet?.withdrawable),
      salaryMin: null,
      salaryMax: null,
      balance: toPaisa(row.wallet?.balance),
      joinedAt: isoDate(row.createdAt) ?? new Date().toISOString(),
    };
  }
}

/** Newest identity check first — that is the one the console reports on. */
const WORKER_INCLUDE = {
  wallet: { select: { balance: true, withdrawable: true } },
  cvProfile: { select: { titles: true, skills: true, summary: true, yearsExperience: true } },
  kycSubmissions: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { status: true },
  },
} satisfies Prisma.UserInclude;

type WorkerRow = Prisma.UserGetPayload<{ include: typeof WORKER_INCLUDE }>;

/** The console's tabs, in this system's terms. */
function statusFilter(status?: string): Prisma.UserWhereInput {
  switch (status) {
    case 'ACTIVE':
      return {
        status: 'ACTIVE',
        kycSubmissions: { some: { status: 'APPROVED' } },
      };
    case 'PENDING':
      return {
        status: 'ACTIVE',
        kycSubmissions: { none: { status: 'APPROVED' } },
      };
    case 'REJECTED':
      return {
        status: 'ACTIVE',
        kycSubmissions: { some: { status: 'REJECTED' } },
      };
    case 'SUSPENDED':
      return { status: { in: ['SUSPENDED', 'DELETED'] } };
    default:
      return {};
  }
}
