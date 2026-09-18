import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriberType } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto, ListSubscriptionsDto, UpdateSubscriptionDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /// "Kon user kon dhoroner subscription kena ache" — one flat list covering
  /// both workers and employers, since Prisma has no native polymorphic
  /// relation. Each row also carries the subscriber's lifetime transacted
  /// amount, since that was asked for alongside this ("k koto taka
  /// transaction kortice").
  async list(query: ListSubscriptionsDto) {
    const where: Prisma.SubscriptionWhereInput = {
      ...(query.plan ? { plan: query.plan } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.subscriberType ? { subscriberType: query.subscriberType } : {}),
      ...(query.search
        ? {
            OR: [
              { worker: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { worker: { code: { contains: query.search, mode: 'insensitive' } } },
              { employer: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { employer: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          worker: { select: { id: true, fullName: true, code: true } },
          employer: { select: { id: true, fullName: true, code: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    const items = await Promise.all(
      rows.map(async (row) => {
        const subscriber = row.worker ?? row.employer;
        const totalTransacted = await this.totalTransacted(row.subscriberType, row.workerId, row.employerId);
        return {
          id: row.id,
          subscriberType: row.subscriberType,
          subscriberId: subscriber?.id ?? null,
          subscriberName: subscriber?.fullName ?? '—',
          subscriberCode: subscriber?.code ?? null,
          plan: row.plan,
          status: row.status,
          price: Number(row.price),
          startedAt: row.startedAt,
          expiresAt: row.expiresAt,
          totalTransacted,
        };
      }),
    );

    return paginate(items, total, query.page, query.limit);
  }

  /// Counts per plan for the summary cards at the top of the screen.
  async summary() {
    const rows = await this.prisma.subscription.groupBy({
      by: ['plan'],
      _count: { _all: true },
      where: { status: 'ACTIVE' },
    });
    const byPlan = { FREE: 0, BASIC: 0, PRO: 0 } as Record<string, number>;
    for (const row of rows) byPlan[row.plan] = row._count._all;
    return { total: rows.reduce((sum, r) => sum + r._count._all, 0), byPlan };
  }

  private async totalTransacted(
    subscriberType: SubscriberType,
    workerId: string | null,
    employerId: string | null,
  ): Promise<number> {
    if (subscriberType === 'WORKER' && workerId) {
      const agg = await this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { workerId, status: 'COMPLETED' },
      });
      return Number(agg._sum.amount ?? 0n);
    }
    if (subscriberType === 'EMPLOYER' && employerId) {
      const agg = await this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { employerId, status: 'COMPLETED' },
      });
      return Number(agg._sum.amount ?? 0n);
    }
    return 0;
  }

  async create(dto: CreateSubscriptionDto, adminId: string) {
    if (dto.subscriberType === 'WORKER' && !dto.workerId) {
      throw new BadRequestException('workerId is required for a worker subscription.');
    }
    if (dto.subscriberType === 'EMPLOYER' && !dto.employerId) {
      throw new BadRequestException('employerId is required for an employer subscription.');
    }
    if (dto.subscriberType === 'WORKER') {
      const worker = await this.prisma.worker.findUnique({ where: { id: dto.workerId } });
      if (!worker) throw new NotFoundException('That worker no longer exists.');
    } else {
      const employer = await this.prisma.employer.findUnique({ where: { id: dto.employerId } });
      if (!employer) throw new NotFoundException('That employer no longer exists.');
    }

    const expiresAt = dto.durationDays
      ? new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000)
      : null;

    const subscription = await this.prisma.subscription.create({
      data: {
        subscriberType: dto.subscriberType,
        workerId: dto.subscriberType === 'WORKER' ? dto.workerId : undefined,
        employerId: dto.subscriberType === 'EMPLOYER' ? dto.employerId : undefined,
        plan: dto.plan,
        price: BigInt(dto.price ?? 0),
        expiresAt,
      },
    });

    await this.audit.record({
      adminId,
      action: 'subscription.create',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { plan: dto.plan, subscriberType: dto.subscriberType },
    });
    return subscription;
  }

  async update(id: string, dto: UpdateSubscriptionDto, adminId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('That subscription no longer exists.');

    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: { ...dto },
    });

    await this.audit.record({
      adminId,
      action: 'subscription.update',
      entityType: 'Subscription',
      entityId: id,
      metadata: { ...dto },
    });
    return subscription;
  }
}
