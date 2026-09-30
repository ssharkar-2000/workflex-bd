import { Injectable } from '@nestjs/common';
import type { Achievements, Badge, BadgeKey } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Badges, earned from the record rather than awarded.
 *
 * Every one of these is a fact the platform can already prove: shifts
 * completed, attendance, ratings given by people who hired them, tests
 * taken, credentials signed by an institution. Nothing here is granted for
 * signing up, filling in a field, or opening the app on consecutive days.
 *
 * That restraint is the whole point. A badge somebody got for turning up to
 * twenty shifts means something to an employer reading it; a badge for
 * completing a profile means nothing to anybody, and having both on the same
 * wall devalues the first. If a badge cannot be earned by doing the work, it
 * is not here.
 *
 * Each one also carries the date it was earned and the count behind it, so a
 * reader can see what it was for rather than taking a gold icon on trust.
 */
@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async of(userId: string): Promise<Achievements> {
    const [shifts, attendance, reviews, mocks, credentials, courses] = await Promise.all([
      this.prisma.shift.findMany({
        where: { workerId: userId },
        select: { status: true, endsAt: true },
        orderBy: { endsAt: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { userId },
        select: { status: true, createdAt: true },
      }),
      this.prisma.review.findMany({
        where: { subjectId: userId, subjectRole: 'WORKER' },
        select: { rating: true, onTime: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.mockTest.findMany({
        where: { userId, submittedAt: { not: null } },
        select: { score: true, total: true, submittedAt: true },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.credential.findMany({
        where: { subjectId: userId, revokedAt: null },
        select: { issuedAt: true },
        orderBy: { issuedAt: 'asc' },
      }),
      this.prisma.courseCompletion.findMany({
        where: { userId },
        select: { declaredAt: true },
        orderBy: { declaredAt: 'asc' },
      }),
    ]);

    const completed = shifts.filter((s) => s.status === 'COMPLETED');
    const noShows = shifts.filter((s) => s.status === 'NO_SHOW').length;
    const lateCount = attendance.filter((a) => a.status === 'LATE').length;

    const rated = reviews.filter((r) => r.rating > 0);
    const avgRating =
      rated.length === 0
        ? null
        : Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10;

    const onTimeRate =
      attendance.length === 0
        ? null
        : Math.round(((attendance.length - lateCount) / attendance.length) * 100);

    const badges: Badge[] = [];

    /** Earned on the date the nth qualifying thing happened, not today. */
    const at = (list: { endsAt?: Date; createdAt?: Date; submittedAt?: Date | null; issuedAt?: Date; declaredAt?: Date }[], n: number) => {
      const row = list[n - 1];
      const date =
        row?.endsAt ?? row?.submittedAt ?? row?.issuedAt ?? row?.declaredAt ?? row?.createdAt;
      return (date ?? new Date()).toISOString();
    };

    if (completed.length >= 5) {
      badges.push(badge('RELIABLE_WORKER', at(completed, 5), completed.length));
    }
    if (completed.length >= 20) {
      badges.push(badge('SEASONED', at(completed, 20), completed.length));
    }
    if (avgRating !== null && avgRating >= 4.5 && rated.length >= 3) {
      badges.push(badge('TOP_RATED', at(rated, 3), rated.length));
    }
    if (onTimeRate !== null && onTimeRate >= 90 && attendance.length >= 5) {
      badges.push(badge('ON_TIME', at(attendance, 5), onTimeRate));
    }
    if (noShows === 0 && completed.length >= 3) {
      badges.push(badge('NEVER_MISSED', at(completed, 3), completed.length));
    }
    if (mocks.length >= 3) {
      badges.push(badge('FAST_LEARNER', at(mocks, 3), mocks.length));
    }
    if (mocks.some((m) => m.score !== null && m.score / m.total >= 0.9)) {
      const first = mocks.find((m) => m.score !== null && m.score / m.total >= 0.9)!;
      badges.push(badge('TOP_SCORE', (first.submittedAt ?? new Date()).toISOString(), 90));
    }
    if (courses.length >= 1) {
      badges.push(badge('SKILL_BUILDER', at(courses, 1), courses.length));
    }
    if (credentials.length >= 1) {
      badges.push(badge('VERIFIED_CREDENTIAL', at(credentials, 1), credentials.length));
    }

    /**
     * What is still out of reach, and how far off.
     *
     * Shown alongside what was earned because a wall of badges with nothing
     * next on it is a wall somebody looks at once. Each locked badge names
     * the number that would unlock it.
     */
    const locked: Achievements['locked'] = [];
    if (completed.length < 5) {
      locked.push({ key: 'RELIABLE_WORKER', have: completed.length, need: 5 });
    } else if (completed.length < 20) {
      locked.push({ key: 'SEASONED', have: completed.length, need: 20 });
    }
    if (mocks.length < 3) locked.push({ key: 'FAST_LEARNER', have: mocks.length, need: 3 });
    if (credentials.length < 1) {
      locked.push({ key: 'VERIFIED_CREDENTIAL', have: 0, need: 1 });
    }
    if (courses.length < 1) locked.push({ key: 'SKILL_BUILDER', have: 0, need: 1 });

    return {
      badges: badges.sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)),
      locked: locked.slice(0, 4),
      stats: {
        completedJobs: completed.length,
        onTimeRate,
        avgRating,
        testsTaken: mocks.length,
        credentials: credentials.length,
      },
    };
  }
}

function badge(key: BadgeKey, earnedAt: string, count: number): Badge {
  return { key, earnedAt, count };
}
