import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CvProfile, Job, Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  DIVISIONS,
  type ApplicationState,
  type ApplyToJobDto,
  type CreateJobDto,
  type JobApplicationList,
  type JobHighlights,
  type JobList,
  type JobListing,
  type JobQuery,
  type MyJobList,
  type Recommendations,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { MatchService } from '../matching/match.service';
import { RecommendService } from '../matching/recommend.service';

const MS_PER_DAY = 86_400_000;

/** How many listings the discovery carousel shows before "See all". */
const HIGHLIGHT_LIMIT = 10;

/** How many suggestions the dashboard row shows. */
const RECOMMENDATION_LIMIT = 8;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: MatchService,
    private readonly recommender: RecommendService,
  ) {}

  /**
   * The account's parsed CV, or null.
   *
   * Fetched once per request and passed down rather than looked up per
   * listing — a twenty-card page would otherwise make twenty identical
   * queries for the same row.
   */
  private cvProfile(userId: string): Promise<CvProfile | null> {
    return this.prisma.cvProfile.findUnique({ where: { userId } });
  }

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

  private toListing(
    job: Job,
    saved: boolean,
    profile: CvProfile | null,
    applied = false,
    /** Whose view this is, for `isMine`. Null on contexts with no viewer. */
    viewerId: string | null = null,
  ): JobListing {
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
      requirements: job.requirements,
      benefits: job.benefits,
      vacancies: job.vacancies,
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
      applied,
      isMine: viewerId !== null && job.postedBy === viewerId,
      // Null, not zero, when there is no CV — see the field's comment in
      // the shared schema. Scoring nothing as "0% match" would tell someone
      // they are a poor fit for work they never asked to be measured against.
      match: profile ? this.matcher.score(profile, job) : null,
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

    const [rows, total, profile] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1, // one extra tells us whether more remain
        ...(query.cursor
          ? { cursor: { id: query.cursor }, skip: 1 }
          : {}),
        include: {
          savedBy: { where: { userId }, select: { userId: true } },
          applications: {
            where: { userId, status: { not: 'WITHDRAWN' } },
            select: { userId: true },
          },
        },
      }),
      this.prisma.job.count({ where }),
      this.cvProfile(userId),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((job) =>
        this.toListing(
          job,
          job.savedBy.length > 0,
          profile,
          job.applications.length > 0,
          userId,
        ),
      ),
      total,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * Creates a posting.
   *
   * The company branch is gated on verification level 2, which is what an
   * approved trade licence records. The check is against the database rather
   * than the caller's token: tokens live fifteen minutes, and a revoked
   * verification has to take effect immediately, not when the token expires.
   */
  async create(userId: string, dto: CreateJobDto): Promise<JobListing> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        verificationLevel: true,
        company: { select: { id: true } },
      },
    });

    if (dto.postAs === 'COMPANY' && user.verificationLevel < 2) {
      throw new AppException(
        ApiErrorCode.COMPANY_VERIFICATION_REQUIRED,
        'A verified trade licence is required to post on behalf of a company',
        HttpStatus.FORBIDDEN,
      );
    }

    let companyId: string | null = user.company?.id ?? null;

    if (dto.postAs === 'COMPANY') {
      // Saved on the first company posting so it is not retyped every time.
      const company = await this.prisma.company.upsert({
        where: { ownerId: userId },
        create: {
          ownerId: userId,
          name: dto.companyName,
          registrationNumber: dto.companyRegistrationNumber,
        },
        update: {
          name: dto.companyName,
          registrationNumber: dto.companyRegistrationNumber,
        },
      });
      companyId = company.id;

      await this.prisma.user.update({
        where: { id: userId },
        data: { designation: dto.designation },
      });
    }

    // An individual posting is attributed to the person, because that is who
    // the worker will actually meet. Inventing a company name for a household
    // job would misrepresent who is hiring.
    const posterName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'WorkFlex member';

    const job = await this.prisma.job.create({
      data: {
        title: dto.title,
        description: dto.description,
        companyName: dto.postAs === 'COMPANY' ? dto.companyName : posterName,
        companyId: dto.postAs === 'COMPANY' ? companyId : null,
        postedBy: userId,

        category: dto.category,
        jobType: dto.jobType,
        // A household job happens where the household is. Remote and hybrid
        // are questions only a business posting needs to answer.
        workplaceType: dto.postAs === 'COMPANY' ? dto.workplaceType : 'ONSITE',
        experienceLevel:
          dto.postAs === 'COMPANY' ? dto.experienceLevel : 'ENTRY',

        location: dto.location,
        division: dto.division,
        district: dto.district,

        paymentType: dto.paymentType,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,

        workingTime: dto.workingTime,
        hoursBand: dto.hoursBand ?? null,
        duration: dto.duration,
        urgency: dto.urgency,

        startDate: dto.startDate ? new Date(dto.startDate) : null,
        flexibleStart: !dto.startDate,
        vacancies: dto.vacancies ?? null,

        requirements: dto.postAs === 'COMPANY' ? (dto.requirements ?? null) : null,
        benefits: dto.postAs === 'COMPANY' ? (dto.benefits ?? null) : null,

        // An individual job has no closing date by default — it is filled when
        // someone takes it, not when a window shuts.
        deadline:
          dto.postAs === 'COMPANY'
            ? new Date(Date.now() + dto.openForDays * 86_400_000)
            : null,
      },
    });

    this.logger.log(`Job ${job.id} posted by ${userId} as ${dto.postAs}`);
    return this.toListing(job, false, null);
  }

  /** Postings this account has created, newest first. */
  async mine(userId: string): Promise<MyJobList> {
    const rows = await this.prisma.job.findMany({
      where: { postedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: {
          select: {
            savedBy: true,
            // Withdrawn applications are excluded: the count is what the
            // poster still has to act on, not everyone who ever tapped apply.
            applications: { where: { status: { not: 'WITHDRAWN' } } },
          },
        },
      },
    });

    return {
      jobs: rows.map((job) => ({
        ...this.toListing(job, false, null, false, userId),
        isOpen: job.isOpen,
        savedByCount: job._count.savedBy,
        applicantCount: job._count.applications,
      })),
    };
  }

  /** Closing hides a posting from the feed without destroying its history. */
  async setOpen(userId: string, id: string, isOpen: boolean): Promise<MyJobList> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { postedBy: true },
    });
    if (!job || job.postedBy !== userId) {
      throw AppException.notFound('That job is not yours to change');
    }
    await this.prisma.job.update({ where: { id }, data: { isOpen } });
    return this.mine(userId);
  }

  async byId(userId: string, id: string): Promise<JobListing> {
    const [job, profile] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id },
        include: {
          savedBy: { where: { userId }, select: { userId: true } },
          applications: {
            where: { userId, status: { not: 'WITHDRAWN' } },
            select: { userId: true },
          },
        },
      }),
      this.cvProfile(userId),
    ]);
    if (!job) throw AppException.notFound('That job is no longer listed');
    return this.toListing(
      job,
      job.savedBy.length > 0,
      profile,
      job.applications.length > 0,
      userId,
    );
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
   * Applying to a posting.
   *
   * Gated on verification level 1 — NID and selfie. Employers here are hiring
   * strangers for shift work, often paying cash on the day; an application
   * from an unverified account is worth nothing to them and erodes trust in
   * every other one. Checked against the database rather than the token, for
   * the same reason company posting is: a revoked verification has to bite
   * immediately, not fifteen minutes later.
   */
  async apply(
    userId: string,
    jobId: string,
    dto: ApplyToJobDto,
  ): Promise<ApplicationState> {
    const [job, user] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, postedBy: true, isOpen: true, deadline: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { verificationLevel: true },
      }),
    ]);

    if (!job) throw AppException.notFound('That job is no longer listed');

    if (job.postedBy === userId) {
      throw new AppException(
        ApiErrorCode.CANNOT_APPLY_OWN_JOB,
        'You cannot apply to your own posting',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!job.isOpen || (job.deadline && job.deadline.getTime() < Date.now())) {
      throw new AppException(
        ApiErrorCode.JOB_CLOSED,
        'This posting has closed',
        HttpStatus.CONFLICT,
      );
    }

    if (user.verificationLevel < 1) {
      throw new AppException(
        ApiErrorCode.VERIFICATION_REQUIRED,
        'Verify your NID and selfie before applying for work',
        HttpStatus.FORBIDDEN,
        { required: 1 },
      );
    }

    const existing = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId, userId } },
    });

    // Applying twice is a no-op, not an error. On a slow connection people
    // tap again; answering that with a failure they have to interpret would
    // be punishing them for the network.
    if (existing && existing.status !== 'WITHDRAWN') {
      return { applied: true, status: existing.status };
    }

    const message = dto.message?.trim() ? dto.message.trim() : null;

    // Upsert rather than create: withdrawing leaves the row in place, so
    // re-applying has to revive it instead of colliding with it.
    const row = await this.prisma.jobApplication.upsert({
      where: { jobId_userId: { jobId, userId } },
      create: { jobId, userId, message },
      update: { status: 'SUBMITTED', message, appliedAt: new Date() },
    });

    return { applied: true, status: row.status };
  }

  /**
   * Withdrawing.
   *
   * Sets the status rather than deleting the row, so a recruiter who has
   * already read the application sees that it was pulled instead of watching
   * it disappear without explanation.
   */
  async withdraw(userId: string, jobId: string): Promise<ApplicationState> {
    const existing = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId, userId } },
    });

    if (!existing || existing.status === 'WITHDRAWN') {
      return { applied: false, status: existing?.status ?? null };
    }

    const row = await this.prisma.jobApplication.update({
      where: { jobId_userId: { jobId, userId } },
      data: { status: 'WITHDRAWN' },
    });

    return { applied: false, status: row.status };
  }

  /**
   * The applicant's own list.
   *
   * Closed and expired postings stay on it. Dropping them would read as the
   * application having been lost, and someone who applied is entitled to see
   * that they did — `jobIsOpen` lets the screen say so instead.
   */
  async myApplications(userId: string): Promise<JobApplicationList> {
    const rows = await this.prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { appliedAt: 'desc' },
      take: 100,
      include: { job: true },
    });

    return {
      applications: rows.map(({ job, ...row }) => ({
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.companyName,
        companyInitials: this.initials(job.companyName),
        category: job.category,
        location: job.location,
        paymentType: job.paymentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        status: row.status,
        message: row.message,
        appliedAt: row.appliedAt.toISOString(),
        jobIsOpen:
          job.isOpen &&
          (!job.deadline || job.deadline.getTime() >= Date.now()),
      })),
    };
  }

  /**
   * Personalised suggestions for the dashboard.
   *
   * Candidates are the open postings this account has not already saved or
   * applied to — suggesting work someone has already acted on is the fastest
   * way to make the row look broken. The ranking itself lives in
   * RecommendService; this method's job is to decide what may be ranked and to
   * shape the result for the client.
   */
  async recommended(userId: string): Promise<Recommendations> {
    const candidates = await this.prisma.job.findMany({
      where: {
        // Both conditions are OR groups, so they go in an AND array rather
        // than side by side — a second `OR` key at this level would replace
        // the first, and the one it replaced is the deadline filter. Spreading
        // `openJobs` and adding `OR` next to it silently starts recommending
        // expired postings.
        AND: [
          this.openJobs,
          // Not mine. Written as an OR rather than `NOT: { postedBy: userId }`
          // because `postedBy` is nullable — the schema says "Null on seeded
          // and imported listings" — and SQL compares NULL to a value as NULL,
          // never as true, so the NOT form silently discarded every ownerless
          // posting. Verified with a probe row: dropped by NOT, kept by this.
          { OR: [{ postedBy: null }, { postedBy: { not: userId } }] },
        ],
        // Not already acted on.
        savedBy: { none: { userId } },
        applications: { none: { userId, status: { not: 'WITHDRAWN' } } },
      },
      orderBy: { createdAt: 'desc' },
      // A window, not the whole catalogue: scoring is arithmetic but it is
      // still per-row, and the newest few hundred contain anything worth
      // surfacing on a dashboard.
      take: 300,
    });

    const profile = await this.cvProfile(userId);

    const { scored, basis } = await this.recommender.recommend(
      userId,
      candidates,
      RECOMMENDATION_LIMIT,
      DIVISIONS.map((d) => d.en),
    );

    return {
      items: scored.map((row) => ({
        job: this.toListing(row.job, false, profile, false, userId),
        fit: row.fit,
        reasons: row.reasons,
        factors: row.factors,
      })),
      basis,
    };
  }

  /** The open-listing predicate, shared by every aggregate below. */
  private get openJobs(): Prisma.JobWhereInput {
    return {
      isOpen: true,
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    };
  }

  /**
   * Headline numbers and the listings most worth acting on this week.
   *
   * "Best" is deliberately defined as *soonest needed*, not as a match score.
   * Nothing on an account records skills or preferences yet, so a "strong
   * match" badge would be a number invented to look clever. Urgency is real,
   * it is this marketplace's distinguishing axis, and it is exactly what a
   * seeker should look at first on a Monday morning.
   */
  async highlights(userId: string): Promise<JobHighlights> {
    const where = this.openJobs;

    const [activeJobs, vacancySum, organizations, rows, profile] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.aggregate({ where, _sum: { vacancies: true } }),
      this.prisma.job.findMany({
        where,
        select: { companyName: true },
        distinct: ['companyName'],
      }),
      this.prisma.job.findMany({
        where: { ...where, urgency: { not: 'NONE' } },
        // Enum order in the schema runs IMMEDIATE → NONE, so ascending sorts
        // the most pressing first without a CASE expression.
        orderBy: [{ urgency: 'asc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
        take: HIGHLIGHT_LIMIT,
        include: { savedBy: { where: { userId }, select: { userId: true } } },
      }),
      this.cvProfile(userId),
    ]);

    // Postings that do not state a count still represent at least one opening,
    // so the total counts them once rather than as zero.
    const stated = await this.prisma.job.count({
      where: { ...where, vacancies: null },
    });

    return {
      stats: {
        activeJobs,
        vacancies: (vacancySum._sum.vacancies ?? 0) + stated,
        organizations: organizations.length,
      },
      jobs: rows.map((job) =>
        this.toListing(job, job.savedBy.length > 0, profile),
      ),
    };
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
