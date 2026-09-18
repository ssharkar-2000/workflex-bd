import { Injectable, Logger } from '@nestjs/common';
import { UserAudience, UserNotificationKind } from '@prisma/client';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

type SendParams = {
  kind: UserNotificationKind;
  workerId?: string | null;
  employerId?: string | null;
  title: string;
  body: string;
  /// Item 7: the admin's written reason, kept separate from the body so the
  /// user's app can render it as a quoted "why" block.
  reason?: string | null;
  entityType?: string;
  entityId?: string;
  /// Also push it out over email where we have an address. Best-effort: a
  /// failed send never blocks the in-app row, which is the source of truth.
  email?: boolean;
};

/**
 * One place for everything the platform says to an end user.
 *
 * Before this existed, an admin action either changed a database column
 * silently (a rejected job just got a `rejectionReason` nobody outside the
 * admin app ever saw) or wrote to `Notification`, which is the *admin's* own
 * feed. Items 7, 8, 9, 10 and 12 all need the opposite direction — a message
 * addressed to one worker or one employer — so they all call `send()` here
 * and the delivery details stay in a single file.
 */
@Injectable()
export class UserNotificationsService {
  private readonly logger = new Logger(UserNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async send(params: SendParams) {
    if (!params.workerId && !params.employerId) {
      // Nothing to address it to. This is not worth throwing over — the admin
      // action that triggered it (rejecting a job, escalating an alert) still
      // succeeded — but it should be visible in the logs rather than silent.
      this.logger.warn(`Dropped a ${params.kind} message with no recipient.`);
      return null;
    }

    const notification = await this.prisma.userNotification.create({
      data: {
        kind: params.kind,
        audience: params.workerId ? UserAudience.WORKER : UserAudience.EMPLOYER,
        workerId: params.workerId ?? null,
        employerId: params.employerId ?? null,
        title: params.title,
        body: params.body,
        reason: params.reason ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    });

    if (params.email) {
      const address = await this.recipientEmail(params.workerId, params.employerId);
      if (address) {
        const text = params.reason
          ? `${params.body}\n\nReason given: ${params.reason}`
          : params.body;
        await this.mail.send([address], params.title, text);
      }
    }

    return notification;
  }

  /// Fan a single message out to every employer account attached to a company
  /// — used when a job is rejected and the poster is the company rather than
  /// one named person (item 7).
  async sendToCompany(companyId: string, params: Omit<SendParams, 'workerId' | 'employerId'>) {
    const employers = await this.prisma.employer.findMany({
      where: { companyId },
      select: { id: true },
    });
    if (employers.length === 0) {
      this.logger.warn(`Company ${companyId} has no employer accounts to notify.`);
      return [];
    }
    return Promise.all(
      employers.map((employer) => this.send({ ...params, employerId: employer.id })),
    );
  }

  private async recipientEmail(workerId?: string | null, employerId?: string | null) {
    if (workerId) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: workerId },
        select: { email: true },
      });
      return worker?.email ?? null;
    }
    if (employerId) {
      const employer = await this.prisma.employer.findUnique({
        where: { id: employerId },
        select: { email: true },
      });
      return employer?.email ?? null;
    }
    return null;
  }

  /// Item 12 — who at a company should receive an escalation. The employer
  /// explicitly flagged `isManager` wins; otherwise the oldest account on the
  /// company stands in, so an escalation is never dropped just because nobody
  /// has been flagged yet.
  async companyManager(companyId: string) {
    return (
      (await this.prisma.employer.findFirst({
        where: { companyId, isManager: true },
        select: { id: true, fullName: true, email: true, phone: true },
      })) ??
      (await this.prisma.employer.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, fullName: true, email: true, phone: true },
      }))
    );
  }
}
