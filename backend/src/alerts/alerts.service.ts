import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListAlertsDto } from './dto/alert.dto';

/// Severity is an enum, so ordering by it alphabetically would put CRITICAL
/// after a lower band. This map drives an explicit sort instead.
const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAlertsDto) {
    const where: Prisma.AlertWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.alert.count({ where }),
    ]);

    const items = rows.sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.detectedAt.getTime() - a.detectedAt.getTime(),
    );

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: { worker: { select: { id: true, fullName: true, code: true } } },
    });
    if (!alert) throw new NotFoundException('That alert no longer exists.');
    return alert;
  }

  /// The three stat cards on the AI Monitoring screen.
  async summary() {
    const [matches, gpsAlerts, fraudBlocked] = await this.prisma.$transaction([
      this.prisma.jobApplication.count(),
      this.prisma.alert.count({ where: { kind: 'FAKE_GPS' } }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.FAILED, type: TransactionType.SALARY_PAYMENT },
      }),
    ]);

    return {
      aiMatches: matches,
      gpsAlerts,
      fraudSaved: Number(fraudBlocked._sum.amount ?? 0n),
      online: true,
    };
  }

  async resolve(id: string, actionTaken: string, adminId: string) {
    const alert = await this.findOne(id);
    if (alert.status === AlertStatus.RESOLVED) {
      throw new BadRequestException('This alert is already resolved.');
    }

    const updated = await this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.RESOLVED, actionTaken, resolvedAt: new Date() },
    });
    await this.audit.record({
      adminId,
      action: 'alert.resolve',
      entityType: 'Alert',
      entityId: id,
      reason: actionTaken,
    });
    return updated;
  }

  async escalate(id: string, actionTaken: string | undefined, adminId: string) {
    const alert = await this.findOne(id);
    if (alert.status === AlertStatus.RESOLVED) {
      throw new BadRequestException('A resolved alert cannot be escalated.');
    }

    const updated = await this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.ESCALATED,
        actionTaken: actionTaken ?? 'Escalated to authorities',
      },
    });
    await this.audit.record({
      adminId,
      action: 'alert.escalate',
      entityType: 'Alert',
      entityId: id,
    });
    return updated;
  }
}
