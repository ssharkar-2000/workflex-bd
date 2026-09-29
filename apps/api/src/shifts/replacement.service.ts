import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { CvProfile, Job, Shift } from '@prisma/client';
import {
  ApiErrorCode,
  type ConfirmReplacementDto,
  type CoverGap,
  type CoverGaps,
  type NotifyReplacementsDto,
  type NotifyResult,
  type ReplacementCandidate,
  type ReplacementList,
  type Reliability,
  type ShiftDetail,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { MatchService } from '../matching/match.service';
import { ShiftsService } from './shifts.service';

/**
 * How the three axes divide a hundred points.
 *
 * Reliability is weighted nearly as heavily as skills, which it is not in the
 * ordinary job feed. That is deliberate: filling a gap tomorrow morning is a
 * different problem from hiring. The question is not who is best at the work,
 * it is who will actually be standing there at six — so somebody who has
 * turned up to eleven shifts outranks a slightly better-skilled stranger.
 */
const WEIGHTS = { skills: 40, reliability: 35, nearby: 25 } as const;

/** More than this and the list stops being a list and becomes a haystack. */
const SHORTLIST = 8;

/** Gaps stop being worth showing once they are this far behind us. */
const STALE_HOURS = 12;

const lineSchema = z.object({
  userId: z.string(),
  why: z.string().describe('One line. Why this person, for this gap. No praise.'),
});

const SYSTEM = `You help an employer in Bangladesh fill a shift somebody has
just cancelled. You are given the shift and a shortlist the system has already
ranked and already checked for clashes.

You do not choose. The order is fixed before you see it and you must not
argue with it, reorder it, or tell the employer who to pick.

You write two things:

1. For each person, one line saying why they are on the list. Use only the
   facts given — the skills that matched, shifts completed, no-shows, rating,
   area, how they already know this job. "Worked 6 shifts for you, no
   no-shows, lives in Mirpur" is the line. Never invent a fact. Never write
   encouragement, and never call anybody reliable, excellent or perfect —
   give the number and let the employer judge.
2. One short message the employer sends to all of them at once. It must say
   what the work is, when it starts, where, and what it pays, because a
   person deciding at short notice needs exactly those four things. Polite,
   plain, no marketing. It must not promise the job to anybody — several
   people receive it and only one will be confirmed, so say that it is first
   to reply. Do not ask for money, documents or personal details.

Write in the language asked for.`;

/**
 * The AI Replacement Matcher.
 *
 * A worker cancels, and the employer has hours rather than days. This finds
 * who could cover, in order, and gets a message to them.
 *
 *     cancelled shift -> who is free -> who can do it -> who turns up
 *                                                     -> employer confirms
 *
 * Two things it deliberately does not do. It does not message anybody by
 * itself: the message arrives under the employer's name and they are the one
 * who has to honour it. And it does not confirm anybody by itself: several
 * people are asked at once, only one slot exists, and a system that auto-hired
 * the first reply would be making a hiring decision nobody asked it to make.
 */
@Injectable()
export class ReplacementService {
  private readonly logger = new Logger(ReplacementService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly match: MatchService,
    private readonly shifts: ShiftsService,
    private readonly config: ConfigService,
  ) {
    const enabled = this.config.get('CV_PARSER') === 'claude';
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('CV_PARSER_MODEL') ?? 'claude-sonnet-5';

    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('Replacement matcher: writing is off, lines will be assembled');
    }
  }

  // --- the gaps ---

  /**
   * Shifts on this employer's jobs that were called off and not yet covered,
   * soonest first.
   *
   * Includes gaps up to STALE_HOURS in the past: somebody looking at this
   * screen at nine in the morning still needs to see the shift that started
   * at six and nobody worked.
   */
  async gaps(employerId: string): Promise<CoverGaps> {
    const since = new Date(Date.now() - STALE_HOURS * 3_600_000);

    const rows = await this.prisma.shift.findMany({
      where: {
        job: { postedBy: employerId },
        status: 'CANCELLED',
        startsAt: { gte: since },
      },
      orderBy: { startsAt: 'asc' },
      take: 50,
      include: {
        job: { select: { id: true, title: true, location: true } },
        worker: { select: { firstName: true, lastName: true } },
      },
    });

    // One query for every replacement already standing, rather than one per
    // gap: a covered slot is any live shift on the same job at the same time.
    const cover =
      rows.length === 0
        ? []
        : await this.prisma.shift.findMany({
            where: {
              jobId: { in: [...new Set(rows.map((row) => row.jobId))] },
              status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            select: { jobId: true, startsAt: true, endsAt: true },
          });

    const gaps = rows.map((row) =>
      this.toGap(
        row,
        row.job,
        row.worker,
        cover.some(
          (other) =>
            other.jobId === row.jobId &&
            other.startsAt < row.endsAt &&
            other.endsAt > row.startsAt,
        ),
      ),
    );

    return { gaps };
  }

  // --- the shortlist ---

  async candidates(employerId: string, shiftId: string): Promise<ReplacementList> {
    const { shift, job } = await this.gapOf(employerId, shiftId);

    const pool = await this.pool(employerId, shift, job);
    const ids = pool.map((person) => person.id);

    const [busy, shiftCounts, ratings, profiles, asked, worker, language] = await Promise.all([
      this.busyIn(ids, shift.startsAt, shift.endsAt),
      this.shiftRecord(ids),
      this.ratings(ids),
      this.profiles(ids),
      this.alreadyAsked(job.id, ids, shift.cancelledAt),
      this.workerOf(shift.workerId),
      this.languageOf(employerId),
    ]);

    const free = pool.filter((person) => !busy.has(person.id));

    const scored = free
      .map((person) => {
        const reliability = this.reliabilityOf(
          shiftCounts.get(person.id),
          ratings.get(person.id) ?? null,
        );
        const profile = profiles.get(person.id);
        const skills = profile ? this.match.score(profile, job) : null;

        const skillScore = Math.round((WEIGHTS.skills * (skills?.score ?? 0)) / 100);
        const reliabilityScore = this.reliabilityPoints(reliability, person.relation);
        const nearbyScore = this.nearbyPoints(person.address, shift.location ?? job.location);

        const candidate: ReplacementCandidate = {
          userId: person.id,
          name:
            [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Worker',
          area: person.address?.trim() ?? '',
          score: skillScore + reliabilityScore + nearbyScore,
          skillScore,
          reliabilityScore,
          nearbyScore,
          matchedSkills: skills?.matchedSkills ?? [],
          reliability,
          relation: person.relation,
          why: '',
          asked: asked.has(person.id),
        };
        return candidate;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, SHORTLIST);

    const gap = this.toGap(shift, job, worker, false);
    const written = scored.length > 0 ? await this.write(gap, scored, language) : null;

    return {
      gap,
      candidates: scored.map((person) => ({
        ...person,
        why: written?.lines.get(person.userId)?.trim() || this.assembleWhy(person, language),
      })),
      draftMessage: written?.message.trim() || this.assembleMessage(gap, language),
      source: written ? 'written' : 'assembled',
      busyCount: pool.length - free.length,
    };
  }

  // --- asking them ---

  /**
   * Send the employer's message to the people they picked.
   *
   * It goes through the ordinary conversation thread, so it lands where every
   * other message about this job lands and the worker can simply reply. Where
   * somebody has worked for this employer before but never applied to *this*
   * job, an application row is created first: the messaging rules require a
   * connection to the job, and being invited to cover it is one.
   */
  async notify(
    employerId: string,
    shiftId: string,
    dto: NotifyReplacementsDto,
  ): Promise<NotifyResult> {
    const { shift, job } = await this.gapOf(employerId, shiftId);

    const pool = await this.pool(employerId, shift, job);
    const allowed = new Set(pool.map((person) => person.id));
    const targets = dto.workerIds.filter((id) => allowed.has(id));
    if (targets.length === 0) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'Those people are not on the shortlist for this shift',
        HttpStatus.BAD_REQUEST,
      );
    }

    const body = dto.message.trim();
    let asked = 0;

    for (const workerId of targets) {
      const sent = await this.prisma.$transaction(async (tx) => {
        await tx.jobApplication.upsert({
          where: { jobId_userId: { jobId: job.id, userId: workerId } },
          // An invitation is not an application they made, so the status says
          // only that we have looked at them — the next move is theirs.
          create: { jobId: job.id, userId: workerId, status: 'VIEWED' },
          update: {},
        });

        const conversation = await tx.conversation.upsert({
          where: { jobId_workerId: { jobId: job.id, workerId } },
          create: { jobId: job.id, workerId, recruiterId: employerId },
          update: {},
          select: { id: true, blockedAt: true },
        });
        // Somebody who blocked this employer does not get written to,
        // however urgent the shift is.
        if (conversation.blockedAt) return false;

        await tx.message.create({
          data: { conversationId: conversation.id, authorId: employerId, body },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });
        return true;
      });
      if (sent) asked += 1;
    }

    this.logger.log(`Cover for shift ${shiftId}: asked ${asked}`);
    return { asked };
  }

  // --- confirming one ---

  /**
   * Put the replacement on the shift.
   *
   * A new row rather than reassigning the cancelled one: the cancellation is
   * a fact about the first worker, and overwriting it would erase who pulled
   * out and when. Both halves of what happened stay on the record.
   */
  async confirm(
    employerId: string,
    shiftId: string,
    dto: ConfirmReplacementDto,
  ): Promise<ShiftDetail> {
    const { shift, job } = await this.gapOf(employerId, shiftId);

    if (dto.workerId === shift.workerId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That is the person who cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    const clash = await this.busyIn([dto.workerId], shift.startsAt, shift.endsAt);
    if (clash.has(dto.workerId)) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'They have taken another shift at that time',
        HttpStatus.CONFLICT,
      );
    }

    const covered = await this.prisma.shift.findFirst({
      where: {
        jobId: job.id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
        startsAt: { lt: shift.endsAt },
        endsAt: { gt: shift.startsAt },
      },
      select: { id: true },
    });
    if (covered) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'Somebody is already covering that slot',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // Confirming cover *is* hiring them for this job — the shift rules
      // require it, and it is also simply what has happened.
      await tx.jobApplication.upsert({
        where: { jobId_userId: { jobId: job.id, userId: dto.workerId } },
        create: { jobId: job.id, userId: dto.workerId, status: 'ACCEPTED' },
        update: { status: 'ACCEPTED' },
      });

      return tx.shift.create({
        data: {
          jobId: job.id,
          workerId: dto.workerId,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          location: shift.location,
          latitude: shift.latitude,
          longitude: shift.longitude,
          pay: shift.pay,
          instructions: shift.instructions,
          contactName: shift.contactName,
          contactPhone: shift.contactPhone,
          dressCode: shift.dressCode,
          requiredDocuments: shift.requiredDocuments,
          cancellationPolicy: shift.cancellationPolicy,
          attendanceMethod: shift.attendanceMethod,
        },
        select: { id: true },
      });
    });

    this.logger.log(`Shift ${shiftId} covered by ${dto.workerId} as ${created.id}`);
    return this.shifts.one(employerId, created.id);
  }

  // --- the pool ---

  /**
   * Who is even considered.
   *
   * Two groups, and no third. People who applied to this job, and people who
   * have completed a shift for this employer before. Not every worker within
   * five kilometres: a cancellation is not a reason to send a stranger a
   * message at ten at night about a job they never asked about.
   */
  private async pool(employerId: string, shift: Shift, job: Job): Promise<PoolPerson[]> {
    const [applicants, past] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where: {
          jobId: job.id,
          status: { in: ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED'] },
          userId: { not: shift.workerId },
        },
        select: {
          status: true,
          user: { select: { id: true, firstName: true, lastName: true, address: true } },
        },
        take: 100,
      }),
      this.prisma.shift.findMany({
        where: {
          job: { postedBy: employerId },
          status: 'COMPLETED',
          workerId: { not: shift.workerId },
        },
        distinct: ['workerId'],
        select: {
          worker: { select: { id: true, firstName: true, lastName: true, address: true } },
        },
        take: 100,
      }),
    ]);

    const byId = new Map<string, PoolPerson>();
    for (const row of past) {
      byId.set(row.worker.id, { ...row.worker, relation: 'WORKED_BEFORE' });
    }
    // Having worked for this employer is the strongest connection and keeps
    // its label; otherwise being shortlisted on this job beats having applied.
    for (const row of applicants) {
      const held = byId.get(row.user.id);
      byId.set(row.user.id, {
        ...row.user,
        relation:
          held?.relation === 'WORKED_BEFORE'
            ? 'WORKED_BEFORE'
            : row.status === 'SHORTLISTED' || row.status === 'ACCEPTED'
              ? 'SHORTLISTED'
              : 'APPLIED',
      });
    }
    return [...byId.values()];
  }

  /** Anyone with a live shift overlapping the window. The hard filter. */
  private async busyIn(ids: string[], startsAt: Date, endsAt: Date): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.shift.findMany({
      where: {
        workerId: { in: ids },
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { workerId: true },
    });
    return new Set(rows.map((row) => row.workerId));
  }

  private async shiftRecord(ids: string[]): Promise<Map<string, Record<string, number>>> {
    const byWorker = new Map<string, Record<string, number>>();
    if (ids.length === 0) return byWorker;

    const rows = await this.prisma.shift.groupBy({
      by: ['workerId', 'status'],
      where: { workerId: { in: ids } },
      _count: { _all: true },
    });
    for (const row of rows) {
      const held = byWorker.get(row.workerId) ?? {};
      held[row.status] = row._count._all;
      byWorker.set(row.workerId, held);
    }
    return byWorker;
  }

  private async ratings(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.review.groupBy({
      by: ['subjectId'],
      where: { subjectId: { in: ids }, subjectRole: 'WORKER' },
      _avg: { rating: true },
    });
    return new Map(
      rows
        .filter((row) => row._avg.rating !== null)
        .map((row) => [row.subjectId, Number(row._avg.rating)] as const),
    );
  }

  private async profiles(ids: string[]): Promise<Map<string, CvProfile>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.cvProfile.findMany({ where: { userId: { in: ids } } });
    return new Map(rows.map((row) => [row.userId, row] as const));
  }

  /**
   * Who has already had this gap's message.
   *
   * Derived rather than stored: a message on this job's thread sent by
   * somebody other than the worker, after the cancellation. It lets the
   * button say "asked" without a table whose only job is one boolean.
   */
  private async alreadyAsked(
    jobId: string,
    ids: string[],
    cancelledAt: Date | null,
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.conversation.findMany({
      where: {
        jobId,
        workerId: { in: ids },
        messages: {
          some: {
            authorId: { notIn: ids },
            createdAt: { gte: cancelledAt ?? new Date(0) },
          },
        },
      },
      select: { workerId: true },
    });
    return new Set(rows.map((row) => row.workerId));
  }

  // --- the arithmetic ---

  private reliabilityOf(
    counts: Record<string, number> | undefined,
    rating: number | null,
  ): Reliability {
    return {
      completed: counts?.COMPLETED ?? 0,
      noShows: counts?.NO_SHOW ?? 0,
      cancelled: counts?.CANCELLED ?? 0,
      rating: rating === null ? null : Math.round(rating * 10) / 10,
    };
  }

  /**
   * Turning a work record into points.
   *
   * Somebody with no record at all sits a little under half rather than at
   * zero. A new worker has not failed anybody; scoring them as though they
   * had would mean nobody new ever gets a first shift, which is the same
   * closed door this platform exists to open. What loses points is a record
   * of not turning up — a thing they did, not a thing they lack.
   */
  private reliabilityPoints(
    reliability: Reliability,
    relation: ReplacementCandidate['relation'],
  ): number {
    const { completed, noShows, cancelled, rating } = reliability;

    const turnedUp = Math.min(completed, 6) / 6;
    const failures = noShows * 2 + cancelled;
    const total = completed + failures;

    const fromRecord = total === 0 ? 0.45 : turnedUp * 0.7 + (1 - failures / total) * 0.3;
    const blended =
      rating === null ? fromRecord : fromRecord * 0.6 + ((rating - 1) / 4) * 0.4;

    // Having worked for this employer before is worth something on its own:
    // they know the site, and the employer knows them.
    const known = relation === 'WORKED_BEFORE' ? 0.1 : 0;

    return Math.round(WEIGHTS.reliability * Math.min(1, blended + known));
  }

  /**
   * How close they are, from the two pieces of text we actually hold.
   *
   * Neither a worker's address nor most shift locations carry coordinates, so
   * this compares the words in them — a shared "mirpur" or "chattogram" is
   * real evidence, and a geocoder is not worth the network call at the moment
   * somebody is trying to fill tomorrow's shift. Nobody is penalised for
   * leaving their address blank: they score the middle, because we do not know.
   */
  private nearbyPoints(address: string | null, location: string): number {
    const theirs = words(address ?? '');
    if (theirs.size === 0) return Math.round(WEIGHTS.nearby * 0.5);

    const site = words(location);
    for (const word of theirs) if (site.has(word)) return WEIGHTS.nearby;
    return Math.round(WEIGHTS.nearby * 0.25);
  }

  // --- the words ---

  private async write(
    gap: CoverGap,
    people: ReplacementCandidate[],
    language: 'en' | 'bn',
  ): Promise<{ lines: Map<string, string>; message: string } | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1600,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(
            z.object({ lines: z.array(lineSchema), message: z.string() }),
          ),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              '',
              'The shift that needs covering:',
              `- Work: ${gap.jobTitle}`,
              `- Starts: ${gap.startsAt} (in ${Math.round(gap.hoursUntil)} hours)`,
              `- Ends: ${gap.endsAt}`,
              `- Where: ${gap.location}`,
              `- Pays: ${Math.round(gap.pay / 100)} taka`,
              '',
              'The shortlist, in the order it will be shown:',
              ...people.map((person, i) =>
                [
                  `${i + 1}. id=${person.userId} name=${person.name}`,
                  `   area: ${person.area || 'not given'}`,
                  `   matched skills: ${person.matchedSkills.join(', ') || 'none recorded'}`,
                  `   shifts completed: ${person.reliability.completed}, no-shows: ${person.reliability.noShows}, cancelled: ${person.reliability.cancelled}`,
                  `   rating: ${person.reliability.rating ?? 'not rated yet'}`,
                  `   how they know this job: ${RELATION_WORDS[person.relation]}`,
                ].join('\n'),
              ),
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const parsed = response.parsed_output;
      if (!parsed?.message) return null;

      return {
        lines: new Map(parsed.lines.map((line) => [line.userId, line.why] as const)),
        message: parsed.message,
      };
    } catch (err) {
      this.logger.error(
        `Replacement writing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** The same line, from the record, when there is no model. */
  private assembleWhy(person: ReplacementCandidate, language: 'en' | 'bn'): string {
    const bits: string[] = [];
    const { completed, noShows, rating } = person.reliability;

    if (language === 'bn') {
      if (person.relation === 'WORKED_BEFORE') bits.push('আগে আপনার কাজ করেছেন');
      if (completed > 0) bits.push(`${bn(completed)}টি শিফট শেষ করেছেন`);
      if (noShows === 0 && completed > 0) bits.push('কোনো অনুপস্থিতি নেই');
      if (noShows > 0) bits.push(`${bn(noShows)} বার আসেননি`);
      if (rating !== null) bits.push(`রেটিং ${bn(rating)}`);
      if (person.matchedSkills.length > 0) bits.push(person.matchedSkills.slice(0, 2).join(', '));
      if (person.area) bits.push(person.area);
      return bits.length > 0 ? bits.join(' · ') : 'নতুন — এখনো কোনো রেকর্ড নেই';
    }

    if (person.relation === 'WORKED_BEFORE') bits.push('has worked for you');
    if (completed > 0) bits.push(`${completed} shift${completed === 1 ? '' : 's'} completed`);
    if (noShows === 0 && completed > 0) bits.push('no no-shows');
    if (noShows > 0) bits.push(`${noShows} no-show${noShows === 1 ? '' : 's'}`);
    if (rating !== null) bits.push(`rated ${rating}`);
    if (person.matchedSkills.length > 0) bits.push(person.matchedSkills.slice(0, 2).join(', '));
    if (person.area) bits.push(person.area);
    return bits.length > 0 ? bits.join(' · ') : 'New here — no record yet';
  }

  /** The same message, assembled. Says the four things and nothing else. */
  private assembleMessage(gap: CoverGap, language: 'en' | 'bn'): string {
    const when = new Date(gap.startsAt);
    const taka = Math.round(gap.pay / 100);

    if (language === 'bn') {
      return [
        `আসসালামু আলাইকুম। ${gap.jobTitle} কাজের একটি শিফট খালি হয়েছে।`,
        `সময়: ${when.toLocaleString('bn-BD')}`,
        `জায়গা: ${gap.location}`,
        `পারিশ্রমিক: ${bn(taka)} টাকা`,
        'পারলে জানান। যিনি আগে রাজি হবেন, তাঁকেই নেওয়া হবে।',
      ].join('\n');
    }
    return [
      `A shift on ${gap.jobTitle} has come free.`,
      `When: ${when.toLocaleString('en-GB')}`,
      `Where: ${gap.location}`,
      `Pay: ${taka} taka`,
      'Reply if you can take it. It goes to whoever answers first.',
    ].join('\n');
  }

  // --- loading ---

  /** The shift, checked to be a gap on a job this employer posted. */
  private async gapOf(employerId: string, shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { job: true },
    });
    if (!shift || shift.job.postedBy !== employerId) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such shift', HttpStatus.NOT_FOUND);
    }
    if (shift.status !== 'CANCELLED') {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That shift has not been cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { shift, job: shift.job };
  }

  private async workerOf(workerId: string) {
    return this.prisma.user.findUnique({
      where: { id: workerId },
      select: { firstName: true, lastName: true },
    });
  }

  private async languageOf(userId: string): Promise<'en' | 'bn'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user?.locale === 'en' ? 'en' : 'bn';
  }

  private toGap(
    shift: Shift,
    job: { id: string; title: string; location: string },
    worker: { firstName: string | null; lastName: string | null } | null,
    covered: boolean,
  ): CoverGap {
    return {
      shiftId: shift.id,
      jobId: job.id,
      jobTitle: job.title,
      workerName:
        [worker?.firstName, worker?.lastName].filter(Boolean).join(' ').trim() || 'Worker',
      startsAt: shift.startsAt.toISOString(),
      endsAt: shift.endsAt.toISOString(),
      location: shift.location ?? job.location,
      pay: shift.pay,
      cancelledAt: shift.cancelledAt?.toISOString() ?? null,
      cancelReason: shift.cancelReason,
      hoursUntil: Math.round(((shift.startsAt.getTime() - Date.now()) / 3_600_000) * 10) / 10,
      covered,
    };
  }
}

type PoolPerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  relation: ReplacementCandidate['relation'];
};

const RELATION_WORDS: Record<ReplacementCandidate['relation'], string> = {
  APPLIED: 'applied to this job',
  SHORTLISTED: 'shortlisted or hired on this job',
  WORKED_BEFORE: 'has completed shifts for this employer',
};

/** Words worth comparing: place names survive, "road" and "house" do not. */
const NOISE = new Set([
  'road',
  'house',
  'flat',
  'block',
  'lane',
  'street',
  'area',
  'near',
  'floor',
  'sector',
  'bazar',
  'para',
  'dhaka',
  'bangladesh',
]);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-zঀ-৿]+/)
      .filter((word) => word.length >= 4 && !NOISE.has(word)),
  );
}

/** Bangla numerals, as everywhere else the user reads a number. */
function bn(value: number): string {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
