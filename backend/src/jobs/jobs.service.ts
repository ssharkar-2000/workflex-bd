import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, JobStatus, Prisma, UserNotificationKind } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { UserNotificationsService } from '../common/user-notifications.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobCategoryDto, CreateJobDto, ListJobsDto, UpdateJobDto } from './dto/job.dto';
import { JobStatus, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto, ListJobsDto, UpdateJobDto } from './dto/job.dto';

const JOB_INCLUDE = {
  company: { select: { id: true, name: true, initials: true } },
  category: { select: { id: true, slug: true, name: true, icon: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobInclude;

/// Item 7 — a rejection notice goes to the employer verbatim, so anything
/// shorter than this is not an explanation they can act on.
const REJECTION_REASON_MIN = 10;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  async list(query: ListJobsDto) {
    const where: Prisma.JobWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { company: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: [{ urgency: 'desc' }, { postedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  /// Counts for the All / Pending / Approved / Featured / Rejected tab row.
  async statusCounts() {
    const [all, pending, approved, rejected, featured] = await this.prisma.$transaction([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.PENDING } }),
      this.prisma.job.count({ where: { status: JobStatus.APPROVED } }),
      this.prisma.job.count({ where: { status: JobStatus.REJECTED } }),
      this.prisma.job.count({ where: { featured: true } }),
    ]);
    return { all, pending, approved, rejected, featured };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!job) throw new NotFoundException('That job no longer exists.');
    return job;
  }

  async create(dto: CreateJobDto, adminId: string) {
    if (dto.salaryMax < dto.salaryMin) {
      throw new BadRequestException('Maximum salary cannot be below the minimum.');
    }

    // `code` used to be derived from `job.count() + 1`. That breaks the moment
    // any job is ever deleted: the count drops, so the next post reuses a code
    // that already exists (e.g. 6 jobs seeded, one deleted -> count is 5, next
    // post computes JOB-0006 again) and the unique constraint on `code` throws,
    // which surfaces to the app as "could not post". Deriving the next number
    // from the highest code actually in use is immune to gaps from deletes.
    const code = await this.nextJobCode();
    const job = await this.prisma.job.create({
      data: {
        code,
    const count = await this.prisma.job.count();
    const job = await this.prisma.job.create({
      data: {
        code: `JOB-${String(count + 1).padStart(4, '0')}`,
        title: dto.title,
        description: dto.description,
        companyId: dto.companyId,
        categoryId: dto.categoryId,
        location: dto.location,
        salaryMin: BigInt(dto.salaryMin),
        salaryMax: BigInt(dto.salaryMax),
        availability: dto.availability,
        experienceMonths: dto.experienceMonths ?? 0,
        urgency: dto.urgency,
      },
      include: JOB_INCLUDE,
    });

    await this.audit.record({
      adminId,
      action: 'job.create',
      entityType: 'Job',
      entityId: job.id,
    });
    return job;
  }

  private async nextJobCode(): Promise<string> {
    const last = await this.prisma.job.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? Number(last.code.split('-')[1]) : 0;
    const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
    return `JOB-${String(nextNumber).padStart(4, '0')}`;
  }

  async update(id: string, dto: UpdateJobDto, adminId: string) {
    await this.findOne(id);
    const { salaryMin, salaryMax, ...rest } = dto;

    const job = await this.prisma.job.update({
      where: { id },
      data: {
        ...rest,
        ...(salaryMin !== undefined ? { salaryMin: BigInt(salaryMin) } : {}),
        ...(salaryMax !== undefined ? { salaryMax: BigInt(salaryMax) } : {}),
      },
      include: JOB_INCLUDE,
    });

    await this.audit.record({
      adminId,
      action: 'job.update',
      entityType: 'Job',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return job;
  }

  async approve(id: string, adminId: string) {
    const existing = await this.findOne(id);
    if (existing.status === JobStatus.APPROVED) {
      throw new BadRequestException('This job is already approved.');
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: { status: JobStatus.APPROVED, reviewedAt: new Date(), rejectionReason: null },
      include: JOB_INCLUDE,
    });
    await this.audit.record({ adminId, action: 'job.approve', entityType: 'Job', entityId: id });
    return job;
  }

  /// Item 7 — "admin je job gula reject korbe, seigular valid reason text
  /// akare user er kache pathabe."
  ///
  /// Two halves. First the reason has to actually be a reason: the screen
  /// used to post a canned default ("Did not meet posting guidelines") and
  /// nothing stopped an empty or one-word string reaching the column, so the
  /// employer would have been told nothing useful. Second — and this is the
  /// part that did not exist at all — the text is delivered to whoever posted
  /// the job as a `UserNotification`, instead of only sitting in a column
  /// that the admin app alone could read.
  async reject(id: string, reason: string, adminId: string) {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < REJECTION_REASON_MIN) {
      throw new BadRequestException(
        `Write a reason of at least ${REJECTION_REASON_MIN} characters — the employer is shown this text word for word.`,
      );
    }

    const existing = await this.findOne(id);
  async reject(id: string, reason: string, adminId: string) {
    await this.findOne(id);
    const job = await this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.REJECTED,
        featured: false,
        reviewedAt: new Date(),
        rejectionReason: trimmed,
      },
      include: JOB_INCLUDE,
    });

    await this.userNotifications.sendToCompany(existing.companyId, {
      kind: UserNotificationKind.JOB_REJECTED,
      title: `Your job post "${existing.title}" was not approved`,
      body:
        `Job ${existing.code} ("${existing.title}") was reviewed and could not be published. ` +
        'You can edit the post and submit it again once the point below is fixed.',
      reason: trimmed,
      entityType: 'Job',
      entityId: id,
      email: true,
    });

        rejectionReason: reason,
      },
      include: JOB_INCLUDE,
    });
    await this.audit.record({
      adminId,
      action: 'job.reject',
      entityType: 'Job',
      entityId: id,
      reason: trimmed,
      reason,
    });
    return job;
  }

  async setFeatured(id: string, featured: boolean, adminId: string) {
    const existing = await this.findOne(id);
    if (featured && existing.status !== JobStatus.APPROVED) {
      throw new BadRequestException('Only approved jobs can be featured.');
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: { featured },
      include: JOB_INCLUDE,
    });
    await this.audit.record({
      adminId,
      action: featured ? 'job.feature' : 'job.unfeature',
      entityType: 'Job',
      entityId: id,
    });
    return job;
  }

  async remove(id: string, adminId: string) {
    await this.findOne(id);

    const attendanceCount = await this.prisma.attendanceRecord.count({ where: { jobId: id } });
    if (attendanceCount > 0) {
      throw new BadRequestException(
        'This job has attendance history attached and cannot be deleted. Reject it instead to remove it from listings.',
      );
    }

    await this.prisma.job.delete({ where: { id } });
    await this.audit.record({
      adminId,
      action: 'job.delete',
      entityType: 'Job',
      entityId: id,
    });
    return { id, deleted: true };
  }

  categories() {
    return this.prisma.jobCategory.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Lets whoever is posting a job add a category on the spot instead of
   * being limited to the preset list. The slug is derived from the name
   * (lowercased, spaces to hyphens) rather than typed, since it only needs
   * to be a stable unique key — the name is what's actually shown anywhere.
   * A category typed twice reuses the existing row rather than erroring,
   * since from the poster's side "add Plumbing" a second time should just
   * work, not fail with a duplicate-slug error.
   */
  async createCategory(dto: CreateJobCategoryDto, adminId: string) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Give the category a name.');

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (!slug) throw new BadRequestException('That name has no usable characters.');

    const existing = await this.prisma.jobCategory.findUnique({ where: { slug } });
    if (existing) return existing;

    const category = await this.prisma.jobCategory.create({
      data: { slug, name, icon: dto.icon?.trim() || '💼' },
    });

    await this.audit.record({
      adminId,
      action: 'job_category.create',
      entityType: 'JobCategory',
      entityId: category.id,
    });

    return category;
  }

  /// Item 23 follow-up: JobDetailScreen only ever showed an applicant
  /// *count* (`_count.applications`) — there was no way to see who actually
  /// applied. `JobApplication` was already a real, populated table (other
  /// services already aggregate over it), just nothing listed the rows.
  async applications(jobId: string) {
    await this.findOne(jobId);
    return this.prisma.jobApplication.findMany({
      where: { jobId },
      orderBy: { appliedAt: 'desc' },
      include: {
        worker: {
          select: {
            id: true,
            code: true,
            fullName: true,
            initials: true,
            profession: true,
            rating: true,
            trustScore: true,
          },
        },
      },
    });
  }

  async setApplicationStatus(
    jobId: string,
    applicationId: string,
    status: ApplicationStatus,
    adminId: string,
  ) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application || application.jobId !== jobId) {
      throw new NotFoundException('That application no longer exists for this job.');
    }

    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status,
        hiredAt: status === ApplicationStatus.HIRED ? new Date() : application.hiredAt,
      },
      include: {
        worker: {
          select: { id: true, code: true, fullName: true, initials: true, profession: true },
        },
      },
    });

    await this.audit.record({
      adminId,
      action: `application.${status.toLowerCase()}`,
      entityType: 'JobApplication',
      entityId: applicationId,
      metadata: { jobId, workerId: application.workerId },
    });

    return updated;
  }

  /// Company picker on the Post a Job form.
  companies() {
    return this.prisma.company.findMany({
      select: { id: true, name: true, initials: true },
      orderBy: { name: 'asc' },
    });
  }

  /// Backs the Job Analytics screen.
  async analytics() {
    const [byCategory, byStatus, totals] = await this.prisma.$transaction([
      this.prisma.job.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        orderBy: { categoryId: 'asc' },
      }),
      this.prisma.job.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.job.aggregate({ _avg: { views: true }, _sum: { views: true } }),
    ]);

    const categories = await this.prisma.jobCategory.findMany();
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const statusList = byStatus as any[];
    const categoryList = byCategory as any[];

    const approved = statusList.find((s) => s.status === JobStatus.APPROVED)?._count?._all ?? 0;
    const all = statusList.reduce((sum, s) => sum + (s._count?._all ?? 0), 0);

    return {
      fillRate: all === 0 ? 0 : Math.round((approved / all) * 1000) / 10,
      totalViews: totals._sum.views ?? 0,
      averageViews: Math.round(totals._avg.views ?? 0),
      byCategory: categoryList.map((row) => ({
        category: nameById.get(row.categoryId) ?? 'Unknown',
        count: row._count?._all ?? 0,
      })),
      byStatus: statusList.map((row) => ({ status: row.status, count: row._count?._all ?? 0 })),
    };
  }
}