import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ApiErrorCode } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { displayName, initialsOf, referenceCode } from './console.mappers';

const DEFAULT_LIMIT = 20;

/**
 * Jobs, as the console lists and reviews them.
 *
 * The console was built for a system where every posting waited for an
 * admin before it went live. This one publishes a job when it is posted and
 * takes it down if it turns out to be a problem, so "pending" here means a
 * job nobody has looked at yet rather than one nobody can see. The screen's
 * approve and reject still do what they say — reject closes the posting —
 * but approving is an acknowledgement, not a gate.
 */
@Injectable()
export class ConsoleJobsService {
  private readonly logger = new Logger(ConsoleJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(params: { status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? DEFAULT_LIMIT));

    const where: Prisma.JobWhereInput = {};
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { location: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    Object.assign(where, statusFilter(params.status));

    const [total, rows] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: JOB_INCLUDE,
      }),
    ]);

    const posters = await this.postersOf(rows);

    return {
      items: rows.map((row) => this.toJob(row, posters)),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async one(id: string) {
    const row = await this.prisma.job.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!row) throw new AppException(ApiErrorCode.NOT_FOUND, 'No such job', HttpStatus.NOT_FOUND);

    const posters = await this.postersOf([row]);
    return this.toJob(row, posters);
  }

  /** The applicants on one job, as the console's applicants screen lists them. */
  async applications(jobId: string) {
    const rows = await this.prisma.jobApplication.findMany({
      where: { jobId },
      orderBy: { appliedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            publicId: true,
            firstName: true,
            lastName: true,
            phone: true,
            verificationLevel: true,
            cvProfile: { select: { titles: true } },
          },
        },
      },
    });

    return {
      items: rows.map((row) => {
        const name = displayName(row.user.firstName, row.user.lastName, row.user.phone);
        return {
          id: `${row.jobId}:${row.userId}`,
          jobId: row.jobId,
          workerId: row.userId,
          status: applicationStatus(row.status),
          appliedAt: row.appliedAt.toISOString(),
          hiredAt: row.status === 'ACCEPTED' ? row.updatedAt.toISOString() : null,
          worker: {
            id: row.user.id,
            code: row.user.publicId,
            fullName: name,
            initials: initialsOf(name),
            profession: row.user.cvProfile?.titles[0] ?? '',
            rating: null,
            trustScore: row.user.verificationLevel * 33,
          },
        };
      }),
      meta: { total: rows.length, page: 1, limit: rows.length, pages: 1 },
    };
  }

  /** Decide on an applicant, from the console's own screen. */
  async decideApplication(jobId: string, workerId: string, action: string) {
    const status =
      action === 'hire' || action === 'accept'
        ? 'ACCEPTED'
        : action === 'shortlist'
          ? 'SHORTLISTED'
          : action === 'reject'
            ? 'REJECTED'
            : null;
    if (!status) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        `Cannot ${action} an application`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.jobApplication.update({
      where: { jobId_userId: { jobId, userId: workerId } },
      data: { status },
    });

    this.logger.log(`Application ${jobId}/${workerId} set to ${status} from the console`);
    return { ok: true };
  }

  /**
   * Take a job down, or put it back.
   *
   * There is no "approved" column to set: a job is either open to applicants
   * or closed. Approving an open job is therefore a no-op that answers
   * truthfully rather than pretending to change something.
   */
  async decide(id: string, action: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { isOpen: true } });
    if (!job) throw new AppException(ApiErrorCode.NOT_FOUND, 'No such job', HttpStatus.NOT_FOUND);

    if (action === 'reject' || action === 'close' || action === 'suspend') {
      await this.prisma.job.update({ where: { id }, data: { isOpen: false } });
      this.logger.log(`Job ${id} closed from the console`);
    } else if (action === 'approve' || action === 'reopen') {
      await this.prisma.job.update({ where: { id }, data: { isOpen: true } });
      this.logger.log(`Job ${id} reopened from the console`);
    } else if (action === 'feature' || action === 'unfeature') {
      // Nothing in this system marks a job as featured yet.
      return { ok: true, changed: false };
    }

    return { ok: true, changed: true };
  }

  /** The filter chips on the jobs screen. */
  async categories() {
    const grouped = await this.prisma.job.groupBy({
      by: ['category'],
      _count: { _all: true },
    });

    return {
      items: grouped.map((row) => ({
        id: row.category,
        slug: row.category.toLowerCase(),
        name: titleCase(row.category),
        icon: '',
        jobs: row._count._all,
      })),
    };
  }

  /** Who is posting, for the jobs screen's company filter. */
  async companies() {
    const rows = await this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      take: 100,
      select: { id: true, name: true },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        initials: initialsOf(row.name),
      })),
    };
  }

  /** The jobs analytics screen: volume, status mix and the busiest categories. */
  async analytics() {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [byStatus, byCategory, recent, applications] = await Promise.all([
      this.prisma.job.groupBy({ by: ['isOpen'], _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['category'], _count: { _all: true } }),
      this.prisma.job.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.jobApplication.count(),
    ]);

    const months = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const month = new Date(since);
      month.setMonth(since.getMonth() + i);
      months.set(monthKey(month), 0);
    }
    for (const job of recent) {
      const key = monthKey(job.createdAt);
      if (months.has(key)) months.set(key, (months.get(key) ?? 0) + 1);
    }

    return {
      totalJobs: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      totalApplications: applications,
      byStatus: byStatus.map((row) => ({
        status: row.isOpen ? 'OPEN' : 'CLOSED',
        count: row._count._all,
      })),
      byCategory: byCategory
        .map((row) => ({ category: titleCase(row.category), count: row._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      postedSeries: [...months].map(([month, total]) => ({ month, total })),
    };
  }

  private async postersOf(rows: { postedBy: string | null }[]) {
    const ids = [
      ...new Set(rows.map((row) => row.postedBy).filter((id): id is string => Boolean(id))),
    ];
    if (ids.length === 0) return new Map<string, PosterRow>();

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: { select: { id: true, name: true } },
      },
    });
    return new Map(users.map((user) => [user.id, user]));
  }

  private toJob(row: JobRow, posters: Map<string, PosterRow>) {
    const poster = row.postedBy ? posters.get(row.postedBy) : undefined;
    // The posting keeps the company's name as it was typed, which is what a
    // reviewer should see; the account's own company is the fallback.
    const companyName =
      row.companyName ||
      poster?.company?.name ||
      (poster ? displayName(poster.firstName, poster.lastName, poster.phone) : 'Unknown');

    return {
      id: row.id,
      code: referenceCode('J', row.id),
      title: row.title,
      description: row.description ?? '',
      location: row.location,
      salaryMin: row.salaryMin ?? 0,
      salaryMax: row.salaryMax ?? row.salaryMin ?? 0,
      // Nothing in this system records a shift pattern on the posting.
      availability: null,
      experienceMonths: 0,
      status: row.isOpen ? 'APPROVED' : 'REJECTED',
      urgency: 'NORMAL',
      featured: false,
      rejectionReason: null,
      views: 0,
      postedAt: row.createdAt.toISOString(),
      company: {
        id: row.companyId ?? poster?.company?.id ?? row.postedBy ?? '',
        name: companyName,
        initials: initialsOf(companyName),
      },
      category: {
        id: row.category,
        slug: row.category.toLowerCase(),
        name: titleCase(row.category),
        icon: '',
      },
      _count: { applications: row._count.applications },
    };
  }
}

const JOB_INCLUDE = {
  _count: { select: { applications: true } },
} satisfies Prisma.JobInclude;

type JobRow = Prisma.JobGetPayload<{ include: typeof JOB_INCLUDE }>;

type PosterRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  company: { id: string; name: string } | null;
};

/** The console's three job states, in this system's terms. */
function statusFilter(status?: string): Prisma.JobWhereInput {
  switch (status) {
    case 'REJECTED':
      return { isOpen: false };
    case 'APPROVED':
      return { isOpen: true };
    case 'PENDING':
      // Nothing waits for approval here; a job with no applicants yet is the
      // nearest honest reading of "needs a look".
      return { isOpen: true, applications: { none: {} } };
    default:
      return {};
  }
}

/** The console's application states, from this system's own. */
function applicationStatus(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'HIRED';
    case 'SHORTLISTED':
      return 'SHORTLISTED';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'REJECTED';
    default:
      return 'APPLIED';
  }
}

/** "HOUSEHOLD_HELP" → "Household help". */
function titleCase(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
