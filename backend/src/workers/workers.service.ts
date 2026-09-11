import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkerStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListWorkersDto, UpdateWorkerDto } from './dto/worker.dto';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListWorkersDto) {
    const where: Prisma.WorkerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.profession ? { profession: { equals: query.profession, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { profession: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.worker.findMany({
        where,
        include: { skills: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.worker.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  /// Powers the "All / Active / Pending / Suspended" filter chips, which show
  /// counts for the whole collection rather than the current page.
  async statusCounts() {
    const rows = await this.prisma.worker.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return {
      total,
      active: counts[WorkerStatus.ACTIVE] ?? 0,
      pending: counts[WorkerStatus.PENDING] ?? 0,
      rejected: counts[WorkerStatus.REJECTED] ?? 0,
      suspended: counts[WorkerStatus.SUSPENDED] ?? 0,
    };
  }

  async findOne(id: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id },
      include: {
        skills: { select: { name: true } },
        certifications: true,
        jobHistory: { orderBy: { startedAt: 'desc' } },
      },
    });
    if (!worker) throw new NotFoundException('That worker no longer exists.');
    return worker;
  }

  async jobHistory(id: string) {
    await this.findOne(id);
    return this.prisma.jobHistoryEntry.findMany({
      where: { workerId: id },
      orderBy: { startedAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateWorkerDto, adminId: string) {
    await this.findOne(id);
    const { skills, salaryMin, salaryMax, ...rest } = dto;

    const worker = await this.prisma.$transaction(async (tx) => {
      if (skills) {
        await tx.workerSkill.deleteMany({ where: { workerId: id } });
        await tx.workerSkill.createMany({
          data: skills.map((name) => ({ workerId: id, name })),
          skipDuplicates: true,
        });
      }
      return tx.worker.update({
        where: { id },
        data: {
          ...rest,
          ...(salaryMin !== undefined ? { salaryMin: BigInt(salaryMin) } : {}),
          ...(salaryMax !== undefined ? { salaryMax: BigInt(salaryMax) } : {}),
        },
        include: { skills: { select: { name: true } } },
      });
    });

    await this.audit.record({
      adminId,
      action: 'worker.update',
      entityType: 'Worker',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return worker;
  }

  async setStatus(id: string, status: WorkerStatus, adminId: string, reason?: string) {
    await this.findOne(id);
    const worker = await this.prisma.worker.update({ where: { id }, data: { status } });
    await this.audit.record({
      adminId,
      action: `worker.${status.toLowerCase()}`,
      entityType: 'Worker',
      entityId: id,
      reason,
    });
    return worker;
  }
}
