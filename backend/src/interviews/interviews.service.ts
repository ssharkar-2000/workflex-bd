import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InterviewStatus, Prisma, UserNotificationKind } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { UserNotificationsService } from '../common/user-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterviewDto, ListInterviewsDto, UpdateInterviewDto } from './dto/interview.dto';

const INTERVIEW_INCLUDE = {
  worker: {
    select: { id: true, code: true, fullName: true, initials: true, profession: true, phone: true },
  },
  job: {
    select: {
      id: true,
      code: true,
      title: true,
      location: true,
      company: { select: { id: true, name: true, initials: true } },
    },
  },
} satisfies Prisma.InterviewInclude;

/**
 * Item 10 — "interview list ki admin manage kora jabe?"
 *
 * Yes, and this is it. An interview is its own row rather than a field on
 * JobApplication because the same applicant can be called back for more than
 * one round, each with its own time, mode and outcome, and because an admin
 * needs to see one list across every job ("who is being interviewed today")
 * as well as the list for a single job.
 */
@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  async list(query: ListInterviewsDto) {
    const where: Prisma.InterviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.workerId ? { workerId: query.workerId } : {}),
      ...(query.from || query.to
        ? {
            scheduledAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { worker: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { job: { title: { contains: query.search, mode: 'insensitive' } } },
              { interviewerName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where,
        include: INTERVIEW_INCLUDE,
        // Upcoming first; the screen's default tab is what's still to happen.
        orderBy: { scheduledAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.interview.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  /// Counts for the Upcoming / Today / Completed / Cancelled tab row.
  async statusCounts() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [all, upcoming, today, completed, cancelled] = await this.prisma.$transaction([
      this.prisma.interview.count(),
      this.prisma.interview.count({
        where: {
          status: { in: [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED] },
          scheduledAt: { gte: new Date() },
        },
      }),
      this.prisma.interview.count({
        where: { scheduledAt: { gte: startOfToday, lt: endOfToday } },
      }),
      this.prisma.interview.count({ where: { status: InterviewStatus.COMPLETED } }),
      this.prisma.interview.count({
        where: { status: { in: [InterviewStatus.CANCELLED, InterviewStatus.NO_SHOW] } },
      }),
    ]);

    return { all, upcoming, today, completed, cancelled };
  }

  async findOne(id: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) throw new NotFoundException('That interview no longer exists.');
    return interview;
  }

  async create(dto: CreateInterviewDto, adminId: string) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('That date and time could not be read.');
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Pick a time in the future.');
    }

    const [job, worker] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: dto.jobId },
        select: { id: true, title: true, code: true, location: true, company: { select: { name: true } } },
      }),
      this.prisma.worker.findUnique({
        where: { id: dto.workerId },
        select: { id: true, fullName: true },
      }),
    ]);
    if (!job) throw new NotFoundException('That job no longer exists.');
    if (!worker) throw new NotFoundException('That worker no longer exists.');

    // If the admin came from the applicant list, keep the link so the
    // applicant row can show "interview scheduled" without a second lookup.
    let applicationId = dto.applicationId ?? null;
    if (!applicationId) {
      const application = await this.prisma.jobApplication.findUnique({
        where: { jobId_workerId: { jobId: dto.jobId, workerId: dto.workerId } },
        select: { id: true },
      });
      applicationId = application?.id ?? null;
    }

    const interview = await this.prisma.interview.create({
      data: {
        jobId: dto.jobId,
        workerId: dto.workerId,
        applicationId,
        scheduledAt,
        durationMinutes: dto.durationMinutes ?? 30,
        mode: dto.mode,
        location: dto.location?.trim() || null,
        interviewerName: dto.interviewerName?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdByAdminId: adminId,
      },
      include: INTERVIEW_INCLUDE,
    });

    await this.userNotifications.send({
      kind: UserNotificationKind.INTERVIEW,
      workerId: dto.workerId,
      title: `Interview scheduled for ${job.title}`,
      body:
        `${job.company.name} has scheduled your interview for "${job.title}" (${job.code}) on ` +
        `${scheduledAt.toISOString()}. ${this.whereLine(interview.mode, dto.location ?? job.location)}`,
      entityType: 'Interview',
      entityId: interview.id,
      email: true,
    });

    await this.audit.record({
      adminId,
      action: 'interview.create',
      entityType: 'Interview',
      entityId: interview.id,
      metadata: { jobId: dto.jobId, workerId: dto.workerId, scheduledAt: scheduledAt.toISOString() },
    });

    return interview;
  }

  async update(id: string, dto: UpdateInterviewDto, adminId: string) {
    const existing = await this.findOne(id);

    let scheduledAt: Date | undefined;
    if (dto.scheduledAt) {
      scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('That date and time could not be read.');
      }
    }

    // Moving the time is a reschedule, not a plain edit — the status reflects
    // that on its own so an admin doesn't have to remember to set it, and the
    // worker gets told about the new time.
    const movedTime =
      scheduledAt !== undefined && scheduledAt.getTime() !== existing.scheduledAt.getTime();

    const interview = await this.prisma.interview.update({
      where: { id },
      data: {
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.mode ? { mode: dto.mode } : {}),
        ...(dto.location !== undefined ? { location: dto.location?.trim() || null } : {}),
        ...(dto.interviewerName !== undefined
          ? { interviewerName: dto.interviewerName?.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.outcome !== undefined ? { outcome: dto.outcome?.trim() || null } : {}),
        ...(dto.status
          ? { status: dto.status }
          : movedTime
            ? { status: InterviewStatus.RESCHEDULED }
            : {}),
      },
      include: INTERVIEW_INCLUDE,
    });

    if (movedTime) {
      await this.userNotifications.send({
        kind: UserNotificationKind.INTERVIEW,
        workerId: existing.workerId,
        title: `Your interview for ${existing.job.title} was moved`,
        body: `The new time is ${scheduledAt!.toISOString()}. ${this.whereLine(
          interview.mode,
          interview.location ?? existing.job.location,
        )}`,
        entityType: 'Interview',
        entityId: id,
        email: true,
      });
    }

    await this.audit.record({
      adminId,
      action: 'interview.update',
      entityType: 'Interview',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });

    return interview;
  }

  async cancel(id: string, reason: string | undefined, adminId: string) {
    const existing = await this.findOne(id);
    if (existing.status === InterviewStatus.CANCELLED) {
      throw new BadRequestException('This interview is already cancelled.');
    }

    const interview = await this.prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.CANCELLED, outcome: reason?.trim() || existing.outcome },
      include: INTERVIEW_INCLUDE,
    });

    await this.userNotifications.send({
      kind: UserNotificationKind.INTERVIEW,
      workerId: existing.workerId,
      title: `Your interview for ${existing.job.title} was cancelled`,
      body:
        'You do not need to attend. If a new time is arranged you will get another message here.',
      reason: reason?.trim() ?? null,
      entityType: 'Interview',
      entityId: id,
      email: true,
    });

    await this.audit.record({
      adminId,
      action: 'interview.cancel',
      entityType: 'Interview',
      entityId: id,
      reason,
    });

    return interview;
  }

  async remove(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.interview.delete({ where: { id } });
    await this.audit.record({
      adminId,
      action: 'interview.delete',
      entityType: 'Interview',
      entityId: id,
    });
    return { id, deleted: true };
  }

  private whereLine(mode: string, location?: string | null): string {
    if (mode === 'VIDEO') return location ? `Join here: ${location}` : 'A video link will follow.';
    if (mode === 'PHONE') return location ? `You will be called on ${location}.` : 'You will be called.';
    return location ? `Address: ${location}` : '';
  }
}
