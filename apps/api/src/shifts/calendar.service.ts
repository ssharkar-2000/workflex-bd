import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Calendar, CalendarEvent } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/** A month either side of today, when the caller asks for no window. */
const DEFAULT_SPAN_DAYS = 45;

/**
 * Everything on one person's calendar, from both sides of the platform.
 *
 * Shifts and interviews live in separate tables with separate rules, but
 * somebody looking at their week does not care which table a Tuesday
 * afternoon came from — they care that they have to be somewhere. This
 * merges the two, marks which side of each the reader is on, and sorts by
 * time.
 *
 * Read-only. Anything that changes a shift or an interview goes through the
 * service that owns it, where the rules are.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async events(userId: string, fromIso?: string, toIso?: string): Promise<Calendar> {
    const from = fromIso ? new Date(fromIso) : daysFromNow(-DEFAULT_SPAN_DAYS);
    const to = toIso ? new Date(toIso) : daysFromNow(DEFAULT_SPAN_DAYS);

    const [shifts, interviews] = await Promise.all([
      this.prisma.shift.findMany({
        where: {
          startsAt: { gte: from, lte: to },
          OR: [{ workerId: userId }, { job: { postedBy: userId } }],
        },
        orderBy: { startsAt: 'asc' },
        take: 200,
        include: {
          job: { select: { id: true, title: true, postedBy: true, location: true, companyName: true } },
          worker: PERSON,
        },
      }),
      this.prisma.interview.findMany({
        where: {
          scheduledAt: { gte: from, lte: to },
          OR: [{ candidateId: userId }, { employerId: userId }],
        },
        orderBy: { scheduledAt: 'asc' },
        take: 200,
        include: {
          job: { select: { id: true, title: true } },
          candidate: PERSON,
          employer: PERSON,
        },
      }),
    ]);

    // A shift's other party is whoever posted the job, which is an id on the
    // job rather than a relation, so those accounts are fetched together.
    const employerIds = [
      ...new Set(
        shifts
          .map((shift) => shift.job.postedBy)
          .filter((id): id is string => Boolean(id) && id !== userId),
      ),
    ];
    const employers = employerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: employerIds } },
          select: PERSON.select,
        })
      : [];
    const employerById = new Map(employers.map((row) => [row.id, row]));

    const events: CalendarEvent[] = [
      ...shifts.map((shift) => {
        const iAmWorker = shift.workerId === userId;
        const other = iAmWorker
          ? (shift.job.postedBy ? employerById.get(shift.job.postedBy) : undefined)
          : shift.worker;

        return {
          id: shift.id,
          kind: 'SHIFT' as const,
          role: (iAmWorker ? 'WORKER' : 'EMPLOYER') as CalendarEvent['role'],
          title: shift.job.title,
          startsAt: shift.startsAt.toISOString(),
          endsAt: shift.endsAt.toISOString(),
          status: shift.status,
          location: shift.location ?? shift.job.location,
          meetingUrl: null,
          mode: null,
          pay: shift.pay,
          notes: shift.instructions,
          job: { id: shift.job.id, title: shift.job.title },
          counterpart: person(other, shift.job.companyName),
        };
      }),

      ...interviews.map((interview) => {
        const iAmCandidate = interview.candidateId === userId;
        const other = iAmCandidate ? interview.employer : interview.candidate;

        return {
          id: interview.id,
          kind: 'INTERVIEW' as const,
          role: (iAmCandidate ? 'WORKER' : 'EMPLOYER') as CalendarEvent['role'],
          title: interview.job.title,
          startsAt: interview.scheduledAt.toISOString(),
          endsAt: new Date(
            interview.scheduledAt.getTime() + interview.durationMinutes * 60_000,
          ).toISOString(),
          status: interview.status,
          location: interview.location,
          // Same rule as the interview screen: the candidate sees the room
          // once they have said they are coming.
          meetingUrl:
            !iAmCandidate || interview.status === 'ACCEPTED' ? interview.meetingUrl : null,
          mode: interview.mode,
          pay: null,
          notes: interview.notes,
          job: { id: interview.job.id, title: interview.job.title },
          counterpart: person(other, other?.company?.name ?? null),
        };
      }),
    ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return { from: from.toISOString(), to: to.toISOString(), events };
  }
}

const PERSON = {
  select: {
    id: true,
    publicId: true,
    firstName: true,
    lastName: true,
    phone: true,
    company: { select: { name: true } },
  },
} satisfies { select: Prisma.UserSelect };

type PersonRow = Prisma.UserGetPayload<{ select: typeof PERSON.select }>;

/**
 * The other party, or a blank one.
 *
 * A job whose poster no longer exists still has shifts on it, and a calendar
 * that throws on that is worse than one that shows the work with nobody's
 * name against it.
 */
function person(row: PersonRow | undefined, company: string | null) {
  if (!row) {
    return { id: '', name: '', publicId: '', phone: null, company };
  }
  return {
    id: row.id,
    name: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.phone,
    publicId: row.publicId,
    phone: row.phone,
    company: row.company?.name ?? company,
  };
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(days < 0 ? 0 : 23, days < 0 ? 0 : 59, 59, 0);
  return date;
}
