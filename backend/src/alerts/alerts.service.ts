import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserNotificationKind,
} from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { UserNotificationsService } from '../common/user-notifications.service';
import { AlertStatus, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListAlertsDto } from './dto/alert.dto';

/// Severity is an enum, so ordering by it alphabetically would put CRITICAL
/// after a lower band. This map drives an explicit sort instead.
const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

/// Item 12 — every list and detail response now carries the company the
/// activity came from, so an admin sees "which company is this?" on the card
/// itself instead of opening the worker to find out.
const ALERT_INCLUDE = {
  worker: { select: { id: true, fullName: true, code: true } },
  company: { select: { id: true, name: true, initials: true, industry: true } },
  escalatedToManager: { select: { id: true, fullName: true, email: true, phone: true } },
} satisfies Prisma.AlertInclude;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  async list(query: ListAlertsDto) {
    const where: Prisma.AlertWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({
        where,
        include: ALERT_INCLUDE,
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
    const alert = await this.prisma.alert.findUnique({ where: { id }, include: ALERT_INCLUDE });
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
      include: ALERT_INCLUDE,
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

  /**
   * Item 12 — "escalate mane alert asle kon company theke astice oita direct
   * dakabe oi company er manager er kache".
   *
   * Escalating used to only flip a status and write the string "Escalated to
   * authorities" into a column — nobody outside the admin app was told
   * anything. Now the alert is routed to a person: the company's flagged
   * manager (falling back to its oldest employer account so an escalation is
   * never dropped for want of a flag), who is recorded on the alert and sent
   * the details directly.
   *
   * The company is resolved in this order: the alert's own `companyId`, then
   * the company on the worker's most recent hire — that second step is what
   * makes this work for the alerts that arrive with no company attached,
   * which is most of them (a fake-GPS check-in knows the worker, not the
   * employer).
   */
  async escalate(id: string, actionTaken: string | undefined, adminId: string) {
    const alert = await this.findOne(id);
    if (alert.status === AlertStatus.RESOLVED) {
      throw new BadRequestException('A resolved alert cannot be escalated.');
    }

    const company = await this.resolveCompany(alert);
    const manager = company ? await this.userNotifications.companyManager(company.id) : null;

    const note =
      actionTaken ??
      (manager
        ? `Escalated to ${manager.fullName} at ${company!.name}`
        : 'Escalated — no company manager on record, handled by the platform team');

    const updated = await this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.ESCALATED,
        actionTaken: note,
        escalatedAt: new Date(),
        escalationNote: note,
        ...(company ? { companyId: company.id } : {}),
        ...(manager ? { escalatedToEmployerId: manager.id } : {}),
      },
      include: ALERT_INCLUDE,
    });

    if (manager) {
      await this.userNotifications.send({
        kind: UserNotificationKind.ALERT_ESCALATION,
        employerId: manager.id,
        title: `Suspicious activity reported at ${company!.name}`,
        body:
          `${alert.severity} alert raised ${alert.detectedAt.toISOString()}: ${alert.message} ` +
          `Person involved: ${alert.subjectName}. ` +
          'Please review and reply here with what you find.',
        entityType: 'Alert',
        entityId: id,
        email: true,
      });
    }

        actionTaken: actionTaken ?? 'Escalated to authorities',
      },
    });
    await this.audit.record({
      adminId,
      action: 'alert.escalate',
      entityType: 'Alert',
      entityId: id,
      reason: note,
      metadata: { companyId: company?.id ?? null, managerId: manager?.id ?? null },
    });

    return updated;
  }

  private async resolveCompany(alert: { companyId: string | null; workerId: string | null }) {
    if (alert.companyId) {
      return this.prisma.company.findUnique({
        where: { id: alert.companyId },
        select: { id: true, name: true },
      });
    }
    if (!alert.workerId) return null;

    // Most alerts only know the worker, so the company is inferred from where
    // that worker was most recently hired.
    const hire = await this.prisma.jobApplication.findFirst({
      where: { workerId: alert.workerId, status: 'HIRED' },
      orderBy: { hiredAt: 'desc' },
      select: { job: { select: { company: { select: { id: true, name: true } } } } },
    });
    return hire?.job.company ?? null;
  }
    });
    return updated;
  }
}
