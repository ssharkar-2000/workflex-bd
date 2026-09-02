import { Injectable } from '@nestjs/common';
import type {
  TrustBand,
  TrustFactor,
  TrustFactorKind,
  TrustScore,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * What each factor is worth.
 *
 * Identity dominates deliberately. It is the only line here that required a
 * person to check a government document against a face, it is what everything
 * else on the platform is gated behind, and it is the thing an employer most
 * wants to know. A photo and an email are cheap by comparison and priced that
 * way; a track record is worth more than either because it cannot be produced
 * on demand.
 *
 * The weights sum to 100, so the score is a percentage of what is provable
 * rather than a curve. A new but fully verified account lands in the sixties —
 * respectable, and visibly short of someone who has actually turned up to
 * work, which is the ordering the number exists to express.
 */
const WEIGHTS: Record<TrustFactorKind, number> = {
  IDENTITY: 40,
  PHOTO: 10,
  EMAIL: 10,
  HIRED: 25,
  RELIABILITY: 15,
  /**
   * Zero-weighted on purpose.
   *
   * A verified trade licence is worth showing — it is why an account may post
   * as a company — but it is not evidence that a *person* is trustworthy, and
   * scoring it would make businesses structurally more trusted than the
   * workers they hire. It appears on the card as a badge and contributes
   * nothing to the total.
   */
  BUSINESS: 0,
};

/** What one upheld report costs. */
const REPORT_PENALTY = 20;

/**
 * The first hire is worth more than the fifth.
 *
 * Being chosen once is the qualitative jump — from unproven to proven — and
 * the rest is confirmation. A linear scale would have said a person hired
 * twenty times is twenty times more trustworthy than someone hired once,
 * which is not what the number means.
 */
function hiredPoints(hired: number): number {
  if (hired <= 0) return 0;
  return Math.min(WEIGHTS.HIRED, 10 + (hired - 1) * 5);
}

function bandFor(score: number): TrustBand {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 65) return 'STRONG';
  if (score >= 40) return 'BUILDING';
  return 'NEW';
}

@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The score, and every factor behind it.
   *
   * Returned together rather than as a bare number so the card can show its
   * own working. A score with no visible arithmetic invites the reader to
   * assume the worst about how it was reached, and gives them nothing to act
   * on when it is lower than they expected.
   */
  async score(userId: string): Promise<TrustScore> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        phone: true,
        email: true,
        emailVerifiedAt: true,
        verificationLevel: true,
        documents: { where: { kind: 'SELFIE' }, select: { id: true } },
      },
    });

    const [hired, attendance, upheldReports] = await Promise.all([
      // ACCEPTED, not "completed": this product has no record of work being
      // finished — attendance is not linked to a posting yet — so the honest
      // claim is that an employer chose this person, which is a real row.
      this.prisma.jobApplication.count({
        where: { userId, status: 'ACCEPTED' },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      // Reports name a phone number rather than an account, because a report
      // has to survive the reported account being deleted. Matching on the
      // number is therefore the only link there is.
      this.prisma.report.count({
        where: {
          targetType: 'PERSON',
          targetPhone: user.phone,
          status: 'ACTION_TAKEN',
        },
      }),
    ]);

    const shifts = attendance.reduce((sum, row) => sum + row._count._all, 0);
    const kept = attendance
      .filter((row) => row.status === 'CHECKED_IN' || row.status === 'CHECKED_OUT')
      .reduce((sum, row) => sum + row._count._all, 0);
    // No shifts means no evidence either way, which is not the same as being
    // unreliable — the factor sits at zero points and the card says so rather
    // than reporting 0%.
    const reliability = shifts > 0 ? kept / shifts : null;

    const identity = user.verificationLevel >= 1;
    const photo = user.documents.length > 0;
    const email = Boolean(user.email) && user.emailVerifiedAt !== null;

    const factors: TrustFactor[] = [
      {
        kind: 'IDENTITY',
        earned: identity,
        points: identity ? WEIGHTS.IDENTITY : 0,
        max: WEIGHTS.IDENTITY,
        detail: null,
      },
      {
        kind: 'HIRED',
        earned: hired > 0,
        points: hiredPoints(hired),
        max: WEIGHTS.HIRED,
        detail: hired,
      },
      {
        kind: 'RELIABILITY',
        earned: reliability !== null && reliability >= 0.9,
        points:
          reliability === null
            ? 0
            : Math.round(reliability * WEIGHTS.RELIABILITY),
        max: WEIGHTS.RELIABILITY,
        detail: reliability === null ? null : Math.round(reliability * 100),
      },
      {
        kind: 'PHOTO',
        earned: photo,
        points: photo ? WEIGHTS.PHOTO : 0,
        max: WEIGHTS.PHOTO,
        detail: null,
      },
      {
        kind: 'EMAIL',
        earned: email,
        points: email ? WEIGHTS.EMAIL : 0,
        max: WEIGHTS.EMAIL,
        detail: null,
      },
    ];

    // Shown only once earned. An unverified individual has no business being
    // told they are missing a trade licence.
    if (user.verificationLevel >= 2) {
      factors.push({
        kind: 'BUSINESS',
        earned: true,
        points: 0,
        max: 1,
        detail: null,
      });
    }

    const earned = factors.reduce((sum, f) => sum + f.points, 0);
    const penalty = Math.min(earned, upheldReports * REPORT_PENALTY);

    return {
      score: Math.max(0, earned - penalty),
      band: bandFor(Math.max(0, earned - penalty)),
      factors,
      upheldReports,
      penalty,
    };
  }
}
