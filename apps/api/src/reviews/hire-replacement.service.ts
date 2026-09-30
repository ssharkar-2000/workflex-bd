import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Job } from '@prisma/client';
import {
  ApiErrorCode,
  type AssignReplacementDto,
  type AvailabilityChanged,
  type ExcludedCandidate,
  type HireCandidate,
  type HireUnavailable,
  type HireUnavailableReason,
  type MarkUnavailableDto,
  type ReplacementAssigned,
  type ReplacementOptions,
  type ReviewRole,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { MessagingService } from '../messaging/messaging.service';
import { assess, bnDigits, firstClash } from './hire-replacement.util';
import { loadStaffing } from './job-staffing';

const PERSON = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  phone: true,
  locale: true,
} as const;

/** Far more shifts than anyone has left on one job; keeps a query bounded. */
const SHIFT_LIMIT = 200;

const REASON_EN: Record<HireUnavailableReason, string> = {
  DROPPED_OUT: 'dropped out',
  SICK: 'unwell',
  NO_SHOW: 'did not turn up',
  OTHER: 'another reason',
};
const REASON_BN: Record<HireUnavailableReason, string> = {
  DROPPED_OUT: 'কাজ ছেড়ে দিয়েছেন',
  SICK: 'অসুস্থ',
  NO_SHOW: 'উপস্থিত হননি',
  OTHER: 'অন্য কারণ',
};

/**
 * Replacing a hired worker who can no longer do the job.
 *
 *     hired -> flagged unavailable -> who could stand in -> assigned
 *
 * Three rules hold the flow together.
 *
 * The flag is not a status. A flagged worker is still an accepted hire, so
 * their payments, reviews and trust keep counting; the flag is what puts them
 * in the employer's Replacement Matcher.
 *
 * Only people the employer has already shortlisted for this job may stand in,
 * so this never invents a hire from strangers, and the choice is always the
 * employer's. Whether a shortlisted person is *eligible* — free for the shifts
 * they would take over, and not plainly failing the posting — is decided here,
 * on the server, both when the list is shown and again when somebody is
 * assigned: a screen that was open for ten minutes cannot assign somebody who
 * has since taken another shift.
 *
 * Assigning is one transaction. The old hire closes, the new one opens, the
 * old worker's coming shifts pass across — or none of it happens.
 */
@Injectable()
export class HireReplacementService {
  private readonly logger = new Logger(HireReplacementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  // --- the flag ---

  /**
   * "This worker can't do the job." Either side may say it: the worker about
   * themselves, or the employer about a worker who has stopped answering.
   * Saying it twice is fine and changes nothing.
   */
  async markUnavailable(
    actorId: string,
    jobId: string,
    workerId: string,
    dto: MarkUnavailableDto,
  ): Promise<AvailabilityChanged> {
    const hire = await this.hireOf(jobId, workerId);
    const side = this.sideOf(actorId, hire.job, workerId);
    this.mustBeOnTheJob(hire);

    if (!hire.unavailableAt) {
      // Guarded on the state it expects, so two taps at once flag it once.
      const { count } = await this.prisma.jobApplication.updateMany({
        where: {
          jobId,
          userId: workerId,
          status: 'ACCEPTED',
          completedAt: null,
          replacedAt: null,
          unavailableAt: null,
        },
        data: {
          unavailableAt: new Date(),
          unavailableReason: dto.reason,
          unavailableNote: dto.note?.trim() || null,
          unavailableBy: side,
        },
      });

      if (count === 1) {
        this.logger.log(`Job ${jobId}: ${workerId} marked unavailable by ${side} ${actorId}`);
        const name = nameOf(hire.user);
        const note = dto.note?.trim();
        const thread = { jobId, workerId, recruiterId: hire.job.postedBy! };
        if (side === 'WORKER') {
          await this.say(
            thread,
            workerId,
            thread.recruiterId,
            {
              en: `⚠ ${name} can no longer do "${hire.job.title}" (${REASON_EN[dto.reason]}).${note ? ` "${note}"` : ''} Open Replacement Matcher to choose a replacement.`,
              bn: `⚠ ${name} আর "${hire.job.title}" কাজটি করতে পারবেন না (${REASON_BN[dto.reason]})।${note ? ` "${note}"` : ''} বিকল্প কর্মী বেছে নিতে "বিকল্প কর্মী খোঁজা" খুলুন।`,
            },
            // The message carries where to go: the app turns it into a button.
            { replacement: { jobId, workerId } },
          );
        } else {
          await this.say(thread, thread.recruiterId, workerId, {
            en: `Your employer has marked you as unavailable for "${hire.job.title}" (${REASON_EN[dto.reason]}). If that is a mistake, reply here.`,
            bn: `নিয়োগকর্তা আপনাকে "${hire.job.title}" কাজের জন্য অনুপলব্ধ হিসেবে চিহ্নিত করেছেন (${REASON_BN[dto.reason]})। ভুল হলে এখানে উত্তর দিন।`,
          });
        }
      }
    }

    return this.stateOf(jobId, workerId);
  }

  /** Undo the flag: they turned out to be available. Only until somebody has been assigned. */
  async markAvailable(actorId: string, jobId: string, workerId: string): Promise<AvailabilityChanged> {
    const hire = await this.hireOf(jobId, workerId);
    const side = this.sideOf(actorId, hire.job, workerId);
    this.mustBeOnTheJob(hire);

    if (hire.unavailableAt) {
      const { count } = await this.prisma.jobApplication.updateMany({
        where: {
          jobId,
          userId: workerId,
          status: 'ACCEPTED',
          completedAt: null,
          replacedAt: null,
          unavailableAt: { not: null },
        },
        data: {
          unavailableAt: null,
          unavailableReason: null,
          unavailableNote: null,
          unavailableBy: null,
        },
      });

      if (count === 1) {
        this.logger.log(`Job ${jobId}: ${workerId} available again, said by ${side} ${actorId}`);
        const name = nameOf(hire.user);
        const thread = { jobId, workerId, recruiterId: hire.job.postedBy! };
        if (side === 'WORKER') {
          await this.say(thread, workerId, thread.recruiterId, {
            en: `✓ ${name} is available again for "${hire.job.title}".`,
            bn: `✓ ${name} আবার "${hire.job.title}" কাজের জন্য প্রস্তুত।`,
          });
        } else {
          await this.say(thread, thread.recruiterId, workerId, {
            en: `Your employer marked you available again for "${hire.job.title}".`,
            bn: `নিয়োগকর্তা আপনাকে "${hire.job.title}" কাজের জন্য আবার উপলব্ধ হিসেবে চিহ্নিত করেছেন।`,
          });
        }
      }
    }

    return this.stateOf(jobId, workerId);
  }

  // --- who could stand in ---

  async options(recruiterId: string, jobId: string, workerId: string): Promise<ReplacementOptions> {
    const hire = await this.hireOf(jobId, workerId);
    this.mustOwn(recruiterId, hire.job);
    this.mustNeedReplacement(hire);
    return this.build(hire);
  }

  // --- choosing one ---

  async assign(
    recruiterId: string,
    jobId: string,
    workerId: string,
    dto: AssignReplacementDto,
  ): Promise<ReplacementAssigned> {
    const replacementId = dto.replacementId;
    const hire = await this.hireOf(jobId, workerId);
    this.mustOwn(recruiterId, hire.job);

    // A second tap, or a second device, finds it already done: the same
    // answer, not an error. Somebody else having been assigned is an error.
    if (hire.replacedAt) {
      if (hire.replacedByUserId === replacementId) {
        return this.assignedResult(hire, replacementId, 0);
      }
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'Somebody has already taken this worker’s place',
        HttpStatus.CONFLICT,
      );
    }
    this.mustNeedReplacement(hire);

    if (replacementId === workerId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That is the person being replaced',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Judged again now, not trusted from whenever the list was drawn.
    const { eligible, excluded } = await this.build(hire);
    if (!eligible.some((person) => person.userId === replacementId)) {
      const left = excluded.find((person) => person.userId === replacementId);
      throw new AppException(
        ApiErrorCode.REPLACEMENT_NOT_ELIGIBLE,
        'That person can not take this place',
        HttpStatus.CONFLICT,
        { reason: left?.reason ?? 'NOT_SHORTLISTED' },
      );
    }

    const now = new Date();
    const moved = await this.prisma.$transaction(async (tx) => {
      // Guarded on everything the flow relies on, so a change made between
      // the check above and here fails this instead of overwriting it.
      const closed = await tx.jobApplication.updateMany({
        where: {
          jobId,
          userId: workerId,
          status: 'ACCEPTED',
          completedAt: null,
          replacedAt: null,
          unavailableAt: { not: null },
        },
        data: { replacedAt: now, replacedByUserId: replacementId, completedAt: now },
      });
      if (closed.count !== 1) {
        throw new AppException(
          ApiErrorCode.ALREADY_PROCESSED,
          'This worker’s place was changed a moment ago',
          HttpStatus.CONFLICT,
        );
      }

      const hired = await tx.jobApplication.updateMany({
        where: { jobId, userId: replacementId, status: 'SHORTLISTED' },
        data: {
          status: 'ACCEPTED',
          replacesUserId: workerId,
          completedAt: null,
          replacedAt: null,
          replacedByUserId: null,
          unavailableAt: null,
          unavailableReason: null,
          unavailableNote: null,
          unavailableBy: null,
        },
      });
      if (hired.count !== 1) {
        throw new AppException(
          ApiErrorCode.REPLACEMENT_NOT_ELIGIBLE,
          'That person is no longer on the shortlist',
          HttpStatus.CONFLICT,
          { reason: 'NOT_SHORTLISTED' },
        );
      }

      // The coming shifts pass across, so the work does not go unstaffed and
      // nothing is left on somebody who is not turning up. Started shifts stay
      // with whoever worked them.
      const shifts = await tx.shift.findMany({
        where: { jobId, workerId, status: 'CONFIRMED', startsAt: { gt: now } },
        select: { id: true, startsAt: true, endsAt: true },
        take: SHIFT_LIMIT,
      });
      if (shifts.length > 0) {
        const theirs = await tx.shift.findMany({
          where: {
            workerId: replacementId,
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            endsAt: { gt: now },
          },
          select: { startsAt: true, endsAt: true },
          take: 1000,
        });
        if (firstClash(shifts, theirs)) {
          throw new AppException(
            ApiErrorCode.REPLACEMENT_NOT_ELIGIBLE,
            'That person has taken another shift at that time',
            HttpStatus.CONFLICT,
            { reason: 'BUSY' },
          );
        }
        await tx.shift.updateMany({
          where: { id: { in: shifts.map((shift) => shift.id) } },
          data: { workerId: replacementId },
        });
      }
      return shifts.length;
    });

    this.logger.log(
      `Job ${jobId}: ${replacementId} replaces ${workerId} (${moved} shift${moved === 1 ? '' : 's'} moved) by ${recruiterId}`,
    );

    await this.tellReplaced(hire, replacementId, moved);
    return this.assignedResult(hire, replacementId, moved);
  }

  // --- the arithmetic of who is eligible ---

  private async build(hire: HireRow): Promise<ReplacementOptions> {
    const { job } = hire;
    const workerId = hire.userId;
    const now = new Date();

    const [applications, shifts] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where: { jobId: job.id, status: 'SHORTLISTED', userId: { not: workerId } },
        orderBy: { appliedAt: 'asc' },
        take: 200,
        include: { user: { select: { ...PERSON, status: true, verificationLevel: true, cvProfile: true } } },
      }),
      this.prisma.shift.findMany({
        where: { jobId: job.id, workerId, status: 'CONFIRMED', startsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
        take: SHIFT_LIMIT,
        select: { id: true, startsAt: true, endsAt: true, location: true },
      }),
    ]);

    const ids = applications.map((row) => row.userId);
    const [blocked, busy] = ids.length
      ? await Promise.all([
          this.prisma.conversation.findMany({
            where: { jobId: job.id, workerId: { in: ids }, blockedAt: { not: null } },
            select: { workerId: true },
          }),
          // Only worth asking when there is a time to be free for.
          shifts.length > 0
            ? this.prisma.shift.findMany({
                where: {
                  workerId: { in: ids },
                  status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
                  endsAt: { gt: now },
                },
                select: { workerId: true, startsAt: true, endsAt: true },
                take: 2000,
              })
            : Promise.resolve([]),
        ])
      : [[], []];
    const blockedIds = new Set(blocked.map((row) => row.workerId));

    const eligible: HireCandidate[] = [];
    const excluded: ExcludedCandidate[] = [];

    for (const row of applications) {
      const name = nameOf(row.user, 'Applicant');
      const left = (
        reason: ExcludedCandidate['reason'],
        extra: Partial<Pick<ExcludedCandidate, 'clashAt' | 'needsYears' | 'hasYears' | 'noSkillMatch'>> = {},
      ) =>
        excluded.push({
          userId: row.userId,
          name,
          reason,
          clashAt: null,
          needsYears: null,
          hasYears: null,
          noSkillMatch: false,
          ...extra,
        });

      if (row.user.status !== 'ACTIVE') {
        left('INACTIVE');
        continue;
      }
      if (blockedIds.has(row.userId)) {
        left('BLOCKED');
        continue;
      }

      const fit = assess(row.user.cvProfile, job);
      if (!fit.meets) {
        left('REQUIREMENTS', {
          needsYears: fit.needsYears,
          hasYears: fit.needsYears === null ? null : (row.user.cvProfile?.yearsExperience ?? null),
          noSkillMatch: fit.noSkillMatch,
        });
        continue;
      }

      const clash = firstClash(
        shifts,
        busy.filter((shift) => shift.workerId === row.userId),
      );
      if (clash) {
        left('BUSY', { clashAt: clash.toISOString() });
        continue;
      }

      eligible.push({
        userId: row.userId,
        publicId: row.user.publicId,
        name,
        verified: row.user.verificationLevel >= 1,
        fit: fit.fit,
        matchedSkills: fit.matched,
        missingSkills: fit.missing,
        yearsExperience: row.user.cvProfile?.yearsExperience ?? null,
        titles: row.user.cvProfile?.titles.slice(0, 4) ?? [],
        hasCv: row.user.cvProfile !== null,
        flags: fit.flags,
        appliedAt: row.appliedAt.toISOString(),
      });
    }

    // Best fit first; whoever applied earlier wins a tie, having waited longer.
    eligible.sort((a, b) => b.fit - a.fit || a.appliedAt.localeCompare(b.appliedAt));

    return {
      job: {
        id: job.id,
        title: job.title,
        location: job.location,
        vacancies: job.vacancies,
      },
      unavailable: {
        userId: workerId,
        publicId: hire.user.publicId,
        name: nameOf(hire.user),
        phone: hire.user.phone,
        reason: hire.unavailableReason ?? 'OTHER',
        note: hire.unavailableNote,
        by: hire.unavailableBy ?? 'RECRUITER',
        at: (hire.unavailableAt ?? now).toISOString(),
      },
      shifts: shifts.map((shift) => ({
        id: shift.id,
        startsAt: shift.startsAt.toISOString(),
        endsAt: shift.endsAt.toISOString(),
        location: shift.location,
      })),
      eligible,
      excluded,
      shortlisted: applications.length,
    };
  }

  // --- loading and checking ---

  private async hireOf(jobId: string, workerId: string) {
    const hire = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId, userId: workerId } },
      include: { job: true, user: { select: PERSON } },
    });
    if (!hire || !hire.job.postedBy) {
      throw AppException.notFound('No such hire');
    }
    return hire;
  }

  /** Which side is acting: the recruiter who posted the job, or the worker themselves. */
  private sideOf(actorId: string, job: Job, workerId: string): ReviewRole {
    if (job.postedBy === actorId) return 'RECRUITER';
    if (workerId === actorId) return 'WORKER';
    throw new AppException(
      ApiErrorCode.FORBIDDEN,
      'Only the worker or the recruiter who hired them can do this',
      HttpStatus.FORBIDDEN,
    );
  }

  private mustOwn(recruiterId: string, job: Job): void {
    if (job.postedBy !== recruiterId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the recruiter who hired this person can replace them',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /** Somebody hired, still on the job: the only kind of hire that can be flagged. */
  private mustBeOnTheJob(hire: HireRow): void {
    if (hire.status !== 'ACCEPTED') {
      throw new AppException(
        ApiErrorCode.NOT_HIRED,
        'Only somebody hired on this job can be marked unavailable',
        HttpStatus.FORBIDDEN,
      );
    }
    if (hire.completedAt || hire.replacedAt) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'This hire has already ended',
        HttpStatus.CONFLICT,
      );
    }
  }

  private mustNeedReplacement(hire: HireRow): void {
    this.mustBeOnTheJob(hire);
    if (!hire.unavailableAt) {
      throw new AppException(
        ApiErrorCode.HIRE_NOT_UNAVAILABLE,
        'Mark the worker as unavailable first',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private unavailableOf(hire: HireRow): HireUnavailable | null {
    if (!hire.unavailableAt) return null;
    return {
      at: hire.unavailableAt.toISOString(),
      reason: hire.unavailableReason ?? 'OTHER',
      note: hire.unavailableNote,
      by: hire.unavailableBy ?? 'RECRUITER',
    };
  }

  private async stateOf(jobId: string, workerId: string): Promise<AvailabilityChanged> {
    const hire = await this.hireOf(jobId, workerId);
    const staffing = await loadStaffing(this.prisma, [{ id: jobId, vacancies: hire.job.vacancies }]);
    return {
      jobId,
      workerId,
      unavailable: this.unavailableOf(hire),
      staffing: staffing.get(jobId)?.staffing ?? 'RECRUITING',
    };
  }

  private async assignedResult(
    hire: HireRow,
    replacementId: string,
    moved: number,
  ): Promise<ReplacementAssigned> {
    const [replacement, staffing] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: replacementId }, select: PERSON }),
      loadStaffing(this.prisma, [{ id: hire.jobId, vacancies: hire.job.vacancies }]),
    ]);
    return {
      jobId: hire.jobId,
      replaced: { userId: hire.userId, name: nameOf(hire.user) },
      replacement: { userId: replacement.id, name: nameOf(replacement), phone: replacement.phone },
      movedShifts: moved,
      staffing: staffing.get(hire.jobId)?.staffing ?? 'RECRUITING',
    };
  }

  // --- telling people ---

  /**
   * The new worker and the old one both hear, in the job's own conversation
   * and in their own language. The employer sees both lines in their inbox
   * and the result on screen.
   */
  private async tellReplaced(hire: HireRow, replacementId: string, moved: number): Promise<void> {
    const title = hire.job.title;
    const recruiterId = hire.job.postedBy!;
    await this.say({ jobId: hire.jobId, workerId: replacementId, recruiterId }, recruiterId, replacementId, {
      en: `🎉 You have been chosen as the replacement on "${title}". You are now hired for this job.${moved > 0 ? ` ${moved} coming shift${moved === 1 ? ' is' : 's are'} now yours.` : ''}`,
      bn: `🎉 "${title}" কাজে আপনাকে বিকল্প কর্মী হিসেবে নেওয়া হয়েছে। এখন আপনি এই কাজে নিয়োগপ্রাপ্ত।${moved > 0 ? ` আসন্ন ${bnDigits(moved)}টি শিফট এখন আপনার।` : ''}`,
    });
    await this.say({ jobId: hire.jobId, workerId: hire.userId, recruiterId }, recruiterId, hire.userId, {
      en: `Your place on "${title}" has been given to a replacement. If you have questions, reply here.`,
      bn: `"${title}" কাজে আপনার জায়গায় একজন বিকল্প কর্মী নেওয়া হয়েছে। কিছু জানার থাকলে এখানে উত্তর দিন।`,
    });
  }

  /**
   * A system line in the job's conversation between this worker and this
   * recruiter, written by `authorId` and read by `readerId`, in the reader's
   * language. It travels over the chat socket and counts as unread like any
   * message.
   *
   * A notification that fails must never fail what it announces: the change
   * has been made either way, so this logs and carries on.
   */
  private async say(
    thread: { jobId: string; workerId: string; recruiterId: string },
    authorId: string,
    readerId: string,
    text: { en: string; bn: string },
    payload?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const reader = await this.prisma.user.findUnique({
        where: { id: readerId },
        select: { locale: true },
      });
      const conversation = await this.prisma.conversation.upsert({
        where: { jobId_workerId: { jobId: thread.jobId, workerId: thread.workerId } },
        create: { jobId: thread.jobId, workerId: thread.workerId, recruiterId: thread.recruiterId },
        update: {},
        select: { id: true },
      });
      await this.messaging.send(authorId, conversation.id, {
        kind: 'SYSTEM',
        body: reader?.locale === 'en' ? text.en : text.bn,
        payload,
      });
    } catch (err) {
      this.logger.warn(
        `Job ${thread.jobId}: could not tell ${readerId} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

type HireRow = Awaited<ReturnType<HireReplacementService['hireOf']>>;

function nameOf(
  user: { firstName: string | null; lastName: string | null },
  fallback = 'Worker',
): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || fallback;
}
