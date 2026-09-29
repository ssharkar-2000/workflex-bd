import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  type CancelInterviewDto,
  type CompleteInterviewDto,
  type Interview,
  type InterviewCounts,
  type InterviewFilter,
  type InterviewList,
  type InterviewSide,
  type RescheduleInterviewDto,
  type RespondToInterviewDto,
  type ScheduleInterviewDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';
import { GoogleService } from '../google/google.service';

/**
 * Interviews: the step between shortlisting somebody and hiring them.
 *
 * Only the person who posted the job may propose one, and only to somebody
 * who applied to it. That is the whole access rule — an interview invitation
 * is not a way to reach a stranger, and the same check keeps the candidate's
 * inbox free of meetings they never asked for.
 *
 * Every meeting is proposed, then answered. It exists as SCHEDULED until the
 * candidate accepts or declines, and nobody should read "scheduled" as
 * "they are coming". A declined interview keeps its row: what was offered
 * and what was said about it is part of the story of that application.
 */
@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly google: GoogleService,
  ) {}

  async list(
    userId: string,
    side: InterviewSide,
    filter: InterviewFilter,
  ): Promise<InterviewList> {
    const mine: Prisma.InterviewWhereInput =
      side === 'HOSTING' ? { employerId: userId } : { candidateId: userId };

    const [rows, counts] = await Promise.all([
      this.prisma.interview.findMany({
        where: { ...mine, ...whereFor(filter) },
        orderBy: filter === 'COMPLETED' ? { scheduledAt: 'desc' } : { scheduledAt: 'asc' },
        take: 50,
        include: INTERVIEW_INCLUDE,
      }),
      this.counts(mine),
    ]);

    return { counts, interviews: rows.map((row) => this.toInterview(row, userId)) };
  }

  async one(userId: string, id: string): Promise<Interview> {
    const row = await this.mine(userId, id);
    return this.toInterview(row, userId);
  }

  /**
   * Propose a meeting.
   *
   * A video interview gets its room now but does not hand it out until the
   * candidate accepts: a link that exists from the moment of invitation is a
   * link anyone forwarded it can sit in, for a meeting nobody agreed to.
   */
  async schedule(userId: string, dto: ScheduleInterviewDto): Promise<Interview> {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, postedBy: true, title: true },
    });
    if (!job || job.postedBy !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'You can only arrange interviews for your own job',
        HttpStatus.FORBIDDEN,
      );
    }

    const application = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId: job.id, userId: dto.candidateId } },
      select: { status: true },
    });
    if (!application) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'That person has not applied to this job',
        HttpStatus.FORBIDDEN,
      );
    }

    // Two meetings for the same pair at overlapping times is somebody
    // double-booking by accident, not by intent.
    const clash = await this.prisma.interview.findFirst({
      where: {
        jobId: job.id,
        candidateId: dto.candidateId,
        status: { in: ['SCHEDULED', 'ACCEPTED', 'RESCHEDULED'] },
      },
      select: { id: true },
    });
    if (clash) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'There is already an interview arranged with this candidate for this job',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.interview.create({
      data: {
        jobId: job.id,
        employerId: userId,
        candidateId: dto.candidateId,
        mode: dto.mode,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        location: dto.mode === 'IN_PERSON' ? (dto.location ?? null) : null,
        meetingUrl: dto.mode === 'VIDEO' ? (dto.meetingUrl ?? this.roomFor()) : null,
        interviewerName: dto.interviewerName ?? null,
        notes: dto.notes ?? null,
      },
      include: INTERVIEW_INCLUDE,
    });

    /**
     * A Google Meet room, when the recruiter has connected Google.
     *
     * Created after the row so the interview's own id can make the request
     * idempotent, and swapped in over the Jitsi room only once it exists.
     * Google being down or not connected costs the recruiter a Meet link,
     * never the interview: the Jitsi room is already on the row and works.
     */
    let row = created;
    if (dto.mode === 'VIDEO' && !dto.meetingUrl) {
      const meet = await this.google.createMeeting(userId, {
        interviewId: created.id,
        title: `Interview: ${job.title}`,
        description:
          `WorkFlex BD interview for ${job.title}. ` +
          'The candidate joins from the link in their WorkFlex BD messages and will ask to be admitted.',
        startsAt: created.scheduledAt,
        durationMinutes: created.durationMinutes,
      });
      if (meet) {
        row = await this.prisma.interview.update({
          where: { id: created.id },
          data: { meetingUrl: meet.url, googleEventId: meet.eventId },
          include: INTERVIEW_INCLUDE,
        });
      }
    }

    // Shortlisting is what an interview means; if the employer skipped that
    // step, the application catches up here rather than sitting at "applied"
    // while its candidate is being interviewed.
    if (application.status === 'SUBMITTED' || application.status === 'VIEWED') {
      await this.prisma.jobApplication.update({
        where: { jobId_userId: { jobId: job.id, userId: dto.candidateId } },
        data: { status: 'SHORTLISTED' },
      });
    }

    await this.tellTheCandidate(row);

    this.logger.log(
      `Interview ${row.id}: ${dto.mode} on ${dto.scheduledAt} for job ${job.id}` +
        (row.googleEventId ? ' (Google Meet)' : ''),
    );
    return this.toInterview(row, userId);
  }

  /** The candidate's answer. */
  async respond(
    userId: string,
    id: string,
    dto: RespondToInterviewDto,
  ): Promise<Interview> {
    const row = await this.mine(userId, id);
    if (row.candidateId !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the candidate can answer an interview',
        HttpStatus.FORBIDDEN,
      );
    }
    if (row.status !== 'SCHEDULED' && row.status !== 'RESCHEDULED') {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'This interview is not waiting for an answer',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: dto.accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date(),
        declineReason: dto.accept ? null : dto.reason?.trim() || null,
      },
      include: INTERVIEW_INCLUDE,
    });

    await this.systemMessage(
      updated,
      dto.accept
        ? `Interview accepted for ${when(updated.scheduledAt)}.`
        : `Interview declined${dto.reason?.trim() ? `: ${dto.reason.trim()}` : '.'}`,
    );

    this.logger.log(`Interview ${id} ${dto.accept ? 'accepted' : 'declined'} by ${userId}`);
    return this.toInterview(updated, userId);
  }

  /** Move it. The candidate is asked again, because the time is new. */
  async reschedule(
    userId: string,
    id: string,
    dto: RescheduleInterviewDto,
  ): Promise<Interview> {
    const row = await this.mine(userId, id);
    if (row.employerId !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the employer can move an interview',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? row.durationMinutes,
        status: 'RESCHEDULED',
        respondedAt: null,
        declineReason: null,
      },
      include: INTERVIEW_INCLUDE,
    });

    // The Meet room keeps its link; only the calendar event's time moves.
    if (updated.googleEventId) {
      await this.google.moveMeeting(
        updated.employerId,
        updated.googleEventId,
        updated.scheduledAt,
        updated.durationMinutes,
      );
    }

    await this.systemMessage(
      updated,
      `Interview moved to ${when(updated.scheduledAt)}${dto.reason?.trim() ? ` — ${dto.reason.trim()}` : ''}. Please confirm.`,
    );

    return this.toInterview(updated, userId);
  }

  /** Called off by either side, with a reason the other one can read. */
  async cancel(userId: string, id: string, dto: CancelInterviewDto): Promise<Interview> {
    const row = await this.mine(userId, id);
    if (row.status === 'COMPLETED') {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'That interview has already happened',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason.trim(),
      },
      include: INTERVIEW_INCLUDE,
    });

    // Removed from the recruiter's calendar with the interview — whichever
    // side cancelled, the event is theirs, so it is their token that is used.
    if (updated.googleEventId) {
      await this.google.cancelMeeting(updated.employerId, updated.googleEventId);
    }

    await this.systemMessage(updated, `Interview cancelled: ${dto.reason.trim()}`);
    this.logger.log(`Interview ${id} cancelled by ${userId}`);
    return this.toInterview(updated, userId);
  }

  /** Afterwards: what came of it. */
  async complete(
    userId: string,
    id: string,
    dto: CompleteInterviewDto,
  ): Promise<Interview> {
    const row = await this.mine(userId, id);
    if (row.employerId !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the employer can close an interview',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: dto.noShow ? 'NO_SHOW' : 'COMPLETED',
        outcome: dto.outcome?.trim() || null,
      },
      include: INTERVIEW_INCLUDE,
    });

    return this.toInterview(updated, userId);
  }

  // --- internals ---

  private async mine(userId: string, id: string) {
    const row = await this.prisma.interview.findUnique({
      where: { id },
      include: INTERVIEW_INCLUDE,
    });
    if (!row || (row.employerId !== userId && row.candidateId !== userId)) {
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No such interview',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  /**
   * The room for a video interview.
   *
   * A Jitsi room, named after nothing guessable, because it needs no account
   * on either side and no meeting provider to integrate. Set
   * INTERVIEW_MEETING_BASE_URL to point at your own service instead.
   */
  private roomFor(): string {
    const base =
      this.config.get('INTERVIEW_MEETING_BASE_URL', { infer: true }) ??
      'https://meet.jit.si';
    const room = `workflex-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return `${base.replace(/\/+$/, '')}/${room}`;
  }

  /**
   * Tell the candidate, in the thread they already share about this job.
   *
   * The invitation goes where the conversation about the job is, rather than
   * into a notification they may never open — and it creates that thread if
   * this is the first thing either side has said.
   */
  private async tellTheCandidate(row: InterviewRow): Promise<void> {
    const line =
      row.mode === 'IN_PERSON'
        ? `Interview invitation: ${when(row.scheduledAt)} at ${row.location ?? 'a place to be confirmed'}.`
        : row.mode === 'PHONE'
          ? `Interview invitation: a phone call at ${when(row.scheduledAt)}.`
          : `Interview invitation: online at ${when(row.scheduledAt)}. The link appears once you accept.`;

    await this.systemMessage(row, `${line} Please accept or decline.`);
  }

  private async systemMessage(row: InterviewRow, body: string): Promise<void> {
    try {
      const conversation = await this.prisma.conversation.upsert({
        where: { jobId_workerId: { jobId: row.jobId, workerId: row.candidateId } },
        create: {
          jobId: row.jobId,
          workerId: row.candidateId,
          recruiterId: row.employerId,
        },
        update: {},
        select: { id: true },
      });

      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          authorId: row.employerId,
          kind: 'INTERVIEW',
          body,
          payload: {
            interviewId: row.id,
            mode: row.mode,
            scheduledAt: row.scheduledAt.toISOString(),
            durationMinutes: row.durationMinutes,
          },
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt },
      });
    } catch (err) {
      // An interview that was arranged but not announced is still arranged.
      // Losing the message is worth a log, not a failed request.
      this.logger.warn(
        `Interview ${row.id}: could not post the message — ${(err as Error).message}`,
      );
    }
  }

  private async counts(mine: Prisma.InterviewWhereInput): Promise<InterviewCounts> {
    const [all, upcoming, today, completed, cancelled, awaiting] = await Promise.all([
      this.prisma.interview.count({ where: mine }),
      this.prisma.interview.count({ where: { ...mine, ...whereFor('UPCOMING') } }),
      this.prisma.interview.count({ where: { ...mine, ...whereFor('TODAY') } }),
      this.prisma.interview.count({ where: { ...mine, status: 'COMPLETED' } }),
      this.prisma.interview.count({
        where: { ...mine, status: { in: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } },
      }),
      this.prisma.interview.count({
        where: { ...mine, status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
      }),
    ]);
    return { all, upcoming, today, completed, cancelled, awaiting };
  }

  /** Public so the meeting-room view maps rows the same way this one does. */
  toInterview(row: InterviewRow, userId: string): Interview {
    const employer = row.employer;
    const candidate = row.candidate;

    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      scheduledAt: row.scheduledAt.toISOString(),
      durationMinutes: row.durationMinutes,
      location: row.location,
      // The employer always sees the room; the candidate sees it once they
      // have said they are coming.
      meetingUrl:
        row.employerId === userId || row.status === 'ACCEPTED' ? row.meetingUrl : null,
      interviewerName: row.interviewerName,
      notes: row.notes,
      outcome: row.outcome,
      declineReason: row.declineReason,
      cancelReason: row.cancelReason,
      respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      job: { id: row.job.id, title: row.job.title, location: row.job.location },
      employer: {
        id: employer.id,
        name: name(employer),
        company: employer.company?.name ?? null,
      },
      candidate: {
        id: candidate.id,
        name: name(candidate),
        publicId: candidate.publicId,
        phone: candidate.phone,
      },
    };
  }
}

export const INTERVIEW_INCLUDE = {
  job: { select: { id: true, title: true, location: true } },
  employer: {
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      phone: true,
      company: { select: { name: true } },
    },
  },
  candidate: {
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      phone: true,
      company: { select: { name: true } },
    },
  },
} satisfies Prisma.InterviewInclude;

type InterviewRow = Prisma.InterviewGetPayload<{ include: typeof INTERVIEW_INCLUDE }>;

function name(user: { firstName: string | null; lastName: string | null; phone: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone;
}

/** "Sat 27 Sep, 3:00 pm" — the way a time is read out here. */
function when(date: Date): string {
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function whereFor(filter: InterviewFilter): Prisma.InterviewWhereInput {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  switch (filter) {
    case 'TODAY':
      return {
        status: { in: ['SCHEDULED', 'ACCEPTED', 'RESCHEDULED'] },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      };
    case 'UPCOMING':
      return {
        status: { in: ['SCHEDULED', 'ACCEPTED', 'RESCHEDULED'] },
        scheduledAt: { gte: dayEnd },
      };
    case 'AWAITING':
      return { status: { in: ['SCHEDULED', 'RESCHEDULED'] } };
    case 'COMPLETED':
      return { status: { in: ['COMPLETED', 'NO_SHOW'] } };
    case 'CANCELLED':
      return { status: { in: ['CANCELLED', 'DECLINED'] } };
    default:
      return {};
  }
}
