import { Injectable } from '@nestjs/common';
import { Job, Prisma } from '@prisma/client';
import type { JobList, JobListing, JobQuery } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initials for the card's logo tile.
   *
   * Postings carry no logo image yet, and a blank square reads as a broken
   * one. Two letters from the company name at least distinguishes the cards
   * from each other while scrolling.
   */
  private initials(companyName: string): string {
    const [first, second] = companyName.trim().split(/\s+/).filter(Boolean);
    if (!first) return '??';
    if (!second) return first.slice(0, 2).toUpperCase();
    return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase();
  }

  private toListing(job: Job, saved: boolean): JobListing {
    return {
      id: job.id,
      title: job.title,
      companyName: job.companyName,
      companyInitials: this.initials(job.companyName),
      category: job.category,
      jobType: job.jobType,
      workplaceType: job.workplaceType,
      experienceLevel: job.experienceLevel,
      location: job.location,
      salaryRange: job.salaryRange,
      description: job.description,
      deadline: job.deadline?.toISOString() ?? null,
      // Rounded up, so a job closing later today reads "1 day left" rather
      // than "0" — which looks expired to someone deciding whether to apply.
      daysLeft: job.deadline
        ? Math.max(
            0,
            Math.ceil((job.deadline.getTime() - Date.now()) / MS_PER_DAY),
          )
        : null,
      postedAt: job.createdAt.toISOString(),
      saved,
    };
  }

  private where(query: JobQuery, userId: string): Prisma.JobWhereInput {
    const where: Prisma.JobWhereInput = {
      isOpen: true,
      // A closed posting is not an opportunity. Null deadlines stay open.
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    };

    if (query.category) where.category = query.category;
    if (query.jobType) where.jobType = query.jobType;
    if (query.workplaceType) where.workplaceType = query.workplaceType;
    if (query.savedOnly) where.savedBy = { some: { userId } };

    if (query.q) {
      // AND-ed with the OR above rather than merged into it — putting the
      // search terms in the same OR array would make a keyword match override
      // the expiry filter and resurrect closed jobs.
      where.AND = [
        {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { companyName: { contains: query.q, mode: 'insensitive' } },
            { location: { contains: query.q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return where;
  }

  async list(userId: string, query: JobQuery): Promise<JobList> {
    const where = this.where(query, userId);

    const [rows, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1, // one extra tells us whether more remain
        ...(query.cursor
          ? { cursor: { id: query.cursor }, skip: 1 }
          : {}),
        include: { savedBy: { where: { userId }, select: { userId: true } } },
      }),
      this.prisma.job.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((job) => this.toListing(job, job.savedBy.length > 0)),
      total,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async byId(userId: string, id: string): Promise<JobListing> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { savedBy: { where: { userId }, select: { userId: true } } },
    });
    if (!job) throw AppException.notFound('That job is no longer listed');
    return this.toListing(job, job.savedBy.length > 0);
  }

  /** Returns the resulting state, so the client does not have to guess. */
  async toggleSaved(userId: string, jobId: string): Promise<{ saved: boolean }> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) throw AppException.notFound('That job is no longer listed');

    const existing = await this.prisma.savedJob.findUnique({
      where: { jobId_userId: { jobId, userId } },
    });

    if (existing) {
      await this.prisma.savedJob.delete({
        where: { jobId_userId: { jobId, userId } },
      });
      return { saved: false };
    }

    await this.prisma.savedJob.create({ data: { jobId, userId } });
    return { saved: true };
  }

  /**
   * How many open jobs sit in each category, for the filter row.
   *
   * One grouped query rather than twenty counts — the screen shows every
   * category at once, and doing this per chip would be twenty round trips on
   * a screen that has to feel instant.
   */
  async categoryCounts(): Promise<Record<string, number>> {
    const rows = await this.prisma.job.groupBy({
      by: ['category'],
      where: {
        isOpen: true,
        OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
      },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.category, r._count._all]));
  }
}
