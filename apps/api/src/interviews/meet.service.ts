import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ApiErrorCode,
  JOIN_OPENS_MINUTES,
  meetingCode,
  readCode,
  type DayInterview,
  type Interview,
  type InterviewDay,
  type WeekDay,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { INTERVIEW_INCLUDE, InterviewsService } from './interviews.service';

const DAY = 86_400_000;

/**
 * The meeting-room view of interviews: one day at a time.
 *
 * The list screen answers "what have I got coming up". This answers "what is
 * on today, and how do I get into it" — which is a different question asked
 * at a different moment, usually a few minutes before something starts.
 *
 * Both ends of every interview are shown together. Somebody hiring for one
 * job is often applying for another, and splitting their Tuesday across two
 * screens would mean the 3pm they are hosting and the 4pm they are attending
 * never appear in the same place.
 */
@Injectable()
export class MeetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interviews: InterviewsService,
  ) {}

  async day(userId: string, dateInput?: string): Promise<InterviewDay> {
    const date = startOfDay(dateInput ? new Date(dateInput) : new Date());
    if (Number.isNaN(date.getTime())) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That is not a date',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Monday-first, because the week starts on a Monday on every Bangladeshi
    // calendar and wall planner somebody will have seen.
    const weekStart = startOfWeek(date);
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY);

    const mine = {
      OR: [{ employerId: userId }, { candidateId: userId }],
    };

    const [inWeek, next] = await Promise.all([
      this.prisma.interview.findMany({
        where: { ...mine, scheduledAt: { gte: weekStart, lt: weekEnd } },
        orderBy: { scheduledAt: 'asc' },
        include: INTERVIEW_INCLUDE,
      }),
      // The next one after today, so an empty day can say when something is
      // rather than only that nothing is.
      this.prisma.interview.findFirst({
        where: {
          ...mine,
          status: { in: ['SCHEDULED', 'ACCEPTED'] },
          scheduledAt: { gte: new Date(date.getTime() + DAY) },
        },
        orderBy: { scheduledAt: 'asc' },
        include: INTERVIEW_INCLUDE,
      }),
    ]);

    const dayEnd = new Date(date.getTime() + DAY);
    const onThisDay = inWeek.filter(
      (row) => row.scheduledAt >= date && row.scheduledAt < dayEnd,
    );

    const week: WeekDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const from = new Date(weekStart.getTime() + i * DAY);
      const to = new Date(from.getTime() + DAY);
      week.push({
        date: ymd(from),
        count: inWeek.filter((row) => row.scheduledAt >= from && row.scheduledAt < to)
          .length,
      });
    }

    return {
      date: ymd(date),
      interviews: onThisDay.map((row) => this.toDay(row, userId)),
      week,
      nextUp: next ? this.toDay(next, userId) : null,
    };
  }

  /**
   * Find an interview from a code somebody typed or a link they pasted.
   *
   * Searched only among the interviews this account is already part of. That
   * is the whole security model and it is stronger than a public meeting
   * service's: guessing a code gets a stranger nothing, because a code that
   * is not theirs matches nothing in the set being searched. It also means
   * this can never leak the existence of somebody else's interview.
   */
  async join(userId: string, input: string): Promise<DayInterview> {
    const wanted = readCode(input);

    const rows = await this.prisma.interview.findMany({
      where: {
        OR: [{ employerId: userId }, { candidateId: userId }],
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 200,
      include: INTERVIEW_INCLUDE,
    });

    const found = rows.find(
      (row) => meetingCode(row.id) === wanted || row.meetingUrl?.toLowerCase().includes(wanted),
    );

    if (!found) {
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No interview of yours matches that code',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toDay(found, userId);
  }

  private toDay(
    row: Parameters<InterviewsService['toInterview']>[0],
    userId: string,
  ): DayInterview {
    const interview: Interview = this.interviews.toInterview(row, userId);
    return {
      ...interview,
      side: row.employerId === userId ? 'HOSTING' : 'ATTENDING',
      code: meetingCode(row.id),
      joinable: joinableNow(interview),
    };
  }
}

/**
 * Whether the Join button should be live.
 *
 * Open from ten minutes before the start until the end, and only for an
 * interview nobody has called off or closed. A button that looks ready six
 * hours early gets pressed six hours early, and somebody sits in an empty
 * room wondering whether they have the wrong day.
 */
function joinableNow(interview: Interview): boolean {
  if (interview.status === 'CANCELLED' || interview.status === 'COMPLETED') return false;

  const start = new Date(interview.scheduledAt).getTime();
  const opens = start - JOIN_OPENS_MINUTES * 60_000;
  const closes = start + interview.durationMinutes * 60_000;
  const now = Date.now();
  return now >= opens && now <= closes;
}

function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the week containing `value`. */
function startOfWeek(value: Date): Date {
  const d = startOfDay(value);
  // getDay() is 0 for Sunday, so Sunday has to reach back six days, not none.
  const back = (d.getDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY);
}

function ymd(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}
