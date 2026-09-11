import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  async reject(id: string, reason: string, adminId: string) {
    await this.findOne(id);
    const job = await this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.REJECTED,
        featured: false,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: JOB_INCLUDE,
    });
    await this.audit.record({
      adminId,
      action: 'job.reject',
      entityType: 'Job',
      entityId: id,
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

  categories() {
    return this.prisma.jobCategory.findMany({ orderBy: { name: 'asc' } });
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