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

      division: job.division,
      district: job.district,
      location: job.location,

      paymentType: job.paymentType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,

      workingTime: job.workingTime,
      hoursBand: job.hoursBand,
      duration: job.duration,
      urgency: job.urgency,

      startDate: job.startDate?.toISOString() ?? null,
      flexibleStart: job.flexibleStart,

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

  /**
   * Turns "this week" into a date range.
   *
   * Resolved on the server, not the client: a phone with a wrong clock or a
   * different timezone would otherwise ask for a window that does not match
   * what anyone else sees, and the same filter would return different jobs on
   * two devices at the same moment.
   *
   * A flexible-start posting matches every window except FLEXIBLE itself,
   * which asks for exactly those. Someone filtering for work starting today
   * is served by an employer who does not mind when you begin.
   */
  private startWindowFilter(
    window: NonNullable<JobQuery['startWindow']>,
  ): Prisma.JobWhereInput {
    if (window === 'FLEXIBLE') return { flexibleStart: true };

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);

    switch (window) {
      case 'TODAY':
        end.setDate(end.getDate() + 1);
        break;
      case 'TOMORROW':
        start.setDate(start.getDate() + 1);
        end.setDate(end.getDate() + 2);
        break;
      case 'THIS_WEEK':
        end.setDate(end.getDate() + 7);
        break;
      case 'THIS_MONTH':
        end.setMonth(end.getMonth() + 1);
        break;
    }

    return {
      OR: [
        { flexibleStart: true },
        { startDate: { gte: start, lt: end } },
      ],
    };
  }

  private where(query: JobQuery, userId: string): Prisma.JobWhereInput {
    const where: Prisma.JobWhereInput = {
      isOpen: true,
      // A closed posting is not an opportunity. Null deadlines stay open.
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    };

    // Every axis is an "in" over the selected values, and the axes AND
    // together: picking Part-Time and Hourly means part-time jobs that pay
    // hourly, not the union of the two.
    if (query.categories) where.category = { in: query.categories };
    if (query.jobTypes) where.jobType = { in: query.jobTypes };
    if (query.workplaceTypes) where.workplaceType = { in: query.workplaceTypes };
    if (query.experienceLevels) {
      where.experienceLevel = { in: query.experienceLevels };
    }
    if (query.paymentTypes) where.paymentType = { in: query.paymentTypes };
    if (query.workingTimes) where.workingTime = { in: query.workingTimes };
    if (query.hoursBands) where.hoursBand = { in: query.hoursBands };
    if (query.durations) where.duration = { in: query.durations };
    if (query.urgencies) where.urgency = { in: query.urgencies };
    if (query.divisions) where.division = { in: query.divisions };
    if (query.districts) where.district = { in: query.districts };
    if (query.savedOnly) where.savedBy = { some: { userId } };

    const and: Prisma.JobWhereInput[] = [];

    /**
     * Salary is an overlap test, not containment.
     *
     * A posting offering ৳15,000–25,000 should match someone asking for at
     * least ৳20,000, because part of what is offered clears their floor.
     * Requiring the posting's whole range to sit inside the filter would hide
     * most listings, and postings with one bound unstated would vanish
     * entirely — hence the nulls being treated as "no objection".
     */
    if (query.salaryMin !== undefined) {
      and.push({
        OR: [{ salaryMax: null }, { salaryMax: { gte: query.salaryMin } }],
      });
    }
    if (query.salaryMax !== undefined) {
      and.push({
        OR: [{ salaryMin: null }, { salaryMin: { lte: query.salaryMax } }],
      });
    }

    if (query.startWindow) {
      and.push(this.startWindowFilter(query.startWindow));
    }

    if (query.q) {
      // AND-ed with the OR above rather than merged into it — putting the
      // search terms in the same OR array would make a keyword match override
      // the expiry filter and resurrect closed jobs.
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { companyName: { contains: query.q, mode: 'insensitive' } },
          { location: { contains: query.q, mode: 'insensitive' } },
          { district: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (and.length > 0) where.AND = and;

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
