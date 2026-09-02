import { Injectable } from '@nestjs/common';
import type { CvProfile, Job } from '@prisma/client';
import type { RecommendationReason } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { MatchService } from './match.service';

/**
 * How much each signal can contribute. Sums to 100.
 *
 * Skills lead because they are what an employer screens on, and because they
 * are the one signal derived from evidence the person supplied deliberately
 * (their CV) rather than inferred from behaviour. Location is next: in this
 * market a job an hour away on three buses is not a job. Availability and
 * category are real but weaker — people are more willing to change shift than
 * to change city.
 */
const WEIGHTS = {
  skills: 40,
  location: 30,
  availability: 15,
  preference: 15,
} as const;

/**
 * A few graded points for how recently a posting went up.
 *
 * The four signals above are all yes/no, which means suggestions that match on
 * the same axes score *identically* — testing produced eight cards every one of
 * which read 53%. That is not a ranking, and a row where nothing is ranked
 * above anything else invites the reader to conclude the number is decorative.
 *
 * Freshness is graded rather than binary, so it separates otherwise-equal
 * suggestions along something real: a posting from this morning is more likely
 * to still be genuinely open than one from three weeks ago. It is small enough
 * that it can never outrank an actual signal, and it is deliberately not a
 * `reason` — being recent is not why a job suits someone.
 */
const FRESHNESS_MAX = 6;
const FRESHNESS_WINDOW_DAYS = 30;

/**
 * A suggestion has to clear this to be shown.
 *
 * Below it the ranking is noise: matching on one weak axis says nothing, and
 * padding the row to a fixed length with near-random jobs is how a
 * "recommended for you" section teaches people to ignore it.
 */
const MIN_FIT = 25;

/** How many postings the taste profile is built from. */
const HISTORY_LIMIT = 40;

/**
 * How often each attribute appears in someone's history, not merely whether
 * it does.
 *
 * These started as plain sets, and membership alone turned out not to
 * discriminate: every candidate matching on the same axes scored identically,
 * so a row of eight suggestions all read the same percentage. Counts fix that
 * honestly — somebody who saved five delivery jobs in Mirpur and one cleaning
 * job in Uttara has expressed a preference of very different strengths, and
 * the ranking should say so.
 */
type Tally = Map<string, number>;

interface Taste {
  divisions: Tally;
  districts: Tally;
  workingTimes: Tally;
  jobTypes: Tally;
  categories: Tally;
  /** True once any history exists at all. */
  any: boolean;
}

/**
 * How strongly one value features in a tally, from 0 to 1.
 *
 * Measured against the most common value rather than the total, so the
 * strongest preference always earns full marks and the rest are ranked
 * relative to it. Dividing by the total would penalise someone with varied
 * taste for having it.
 */
function strength(tally: Tally, value: string | null): number {
  if (!value) return 0;
  const seen = tally.get(value);
  if (!seen) return 0;
  const top = Math.max(...tally.values());
  return top === 0 ? 0 : seen / top;
}

function bump(tally: Tally, value: string | null): void {
  if (!value) return;
  tally.set(value, (tally.get(value) ?? 0) + 1);
}

@Injectable()
export class RecommendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: MatchService,
  ) {}

  /**
   * What this person has shown interest in.
   *
   * Saved and applied are treated as one pool rather than weighted apart.
   * They differ in strength — applying is a bigger commitment than
   * bookmarking — but with the handful of rows a new account has, splitting
   * them buys precision the sample size cannot support.
   */
  private async taste(userId: string): Promise<Taste> {
    const [saved, applied] = await Promise.all([
      this.prisma.savedJob.findMany({
        where: { userId },
        orderBy: { savedAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { job: true },
      }),
      this.prisma.jobApplication.findMany({
        where: { userId, status: { not: 'WITHDRAWN' } },
        orderBy: { appliedAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { job: true },
      }),
    ]);

    const jobs = [...saved, ...applied].map((row) => row.job);

    const taste: Taste = {
      divisions: new Map(),
      districts: new Map(),
      workingTimes: new Map(),
      jobTypes: new Map(),
      categories: new Map(),
      any: jobs.length > 0,
    };

    for (const job of jobs) {
      bump(taste.divisions, job.division);
      bump(taste.districts, job.district);
      bump(taste.workingTimes, job.workingTime);
      bump(taste.jobTypes, job.jobType);
      bump(taste.categories, job.category);
    }

    return taste;
  }

  /**
   * Location, from the free-text address when there is no history.
   *
   * `User.address` is what someone typed at registration — "House 12, Road 5,
   * Dhanmondi, Dhaka". There is no structured division on the account, so the
   * division names are matched against that string. Crude, but it is the
   * difference between a new user seeing work near them and seeing the whole
   * country, and it costs nothing.
   */
  private divisionFromAddress(
    address: string | null,
    divisions: readonly string[],
  ): string | null {
    if (!address) return null;
    const lower = address.toLowerCase();
    return divisions.find((d) => lower.includes(d.toLowerCase())) ?? null;
  }

  private scoreJob(
    job: Job,
    taste: Taste,
    homeDivision: string | null,
    profile: CvProfile | null,
  ): { fit: number; reasons: RecommendationReason[] } {
    const reasons: RecommendationReason[] = [];
    let fit = 0;

    // --- skills, borrowed from the CV matcher rather than reimplemented ---
    if (profile) {
      const match = this.matcher.score(profile, job);
      const earned = Math.round((match.score / 100) * WEIGHTS.skills);
      fit += earned;
      // Half the available weight is a real signal, not a rounding artefact.
      if (earned >= WEIGHTS.skills * 0.5) reasons.push('SKILLS');
    }

    // --- location ---
    // District is the meaningful unit for a commute; division is the coarse
    // fallback, worth less because a division can be a day's travel across.
    // Each is scaled by how often the person has chosen it before.
    const districtPull = strength(taste.districts, job.district);
    const divisionPull = strength(taste.divisions, job.division);

    if (districtPull > 0) {
      fit += Math.round(WEIGHTS.location * districtPull);
      reasons.push('LOCATION');
    } else if (divisionPull > 0) {
      fit += Math.round(WEIGHTS.location * 0.6 * divisionPull);
      reasons.push('LOCATION');
    } else if (job.division && job.division === homeDivision) {
      // No history to go on, so this comes from the registered address. Worth
      // less than a demonstrated choice, because it is an inference.
      fit += Math.round(WEIGHTS.location * 0.5);
      reasons.push('LOCATION');
    }

    // --- availability ---
    const hoursPull = strength(taste.workingTimes, job.workingTime);
    if (hoursPull > 0) {
      fit += Math.round(WEIGHTS.availability * hoursPull);
      reasons.push('AVAILABILITY');
    }

    // --- preferences: what kind of work ---
    const categoryPull = strength(taste.categories, job.category);
    const typePull = strength(taste.jobTypes, job.jobType);

    if (categoryPull > 0) {
      fit += Math.round(WEIGHTS.preference * categoryPull);
      reasons.push('PREFERENCE');
    } else if (typePull > 0) {
      fit += Math.round(WEIGHTS.preference * 0.5 * typePull);
      reasons.push('PREFERENCE');
    }

    // Only worth adding once something real has matched — otherwise a stale
    // job with no connection to the person could creep over the threshold on
    // recency alone.
    if (reasons.length > 0) {
      const ageDays =
        (Date.now() - job.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      fit += Math.round(
        FRESHNESS_MAX * Math.max(0, 1 - ageDays / FRESHNESS_WINDOW_DAYS),
      );
    }

    return { fit: Math.min(100, fit), reasons };
  }

  /**
   * Ranks open postings for one person.
   *
   * Returns an empty list rather than a filled one when there is nothing to
   * personalise on. A brand-new account with no CV and no history has told us
   * nothing, and presenting arbitrary jobs under "Recommended for you" is a
   * claim the system cannot support — the feed already exists for browsing.
   */
  async recommend(
    userId: string,
    candidates: Job[],
    limit: number,
    divisionNames: readonly string[],
  ) {
    const [taste, profile, user] = await Promise.all([
      this.taste(userId),
      this.prisma.cvProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { address: true },
      }),
    ]);

    const homeDivision = this.divisionFromAddress(
      user?.address ?? null,
      divisionNames,
    );

    const basis = {
      skills: profile !== null,
      location: taste.districts.size > 0 || taste.divisions.size > 0 || homeDivision !== null,
      availability: taste.workingTimes.size > 0,
      preferences: taste.categories.size > 0 || taste.jobTypes.size > 0,
    };

    // Nothing known about this person: say so instead of guessing.
    if (!basis.skills && !taste.any && !homeDivision) {
      return { scored: [], basis };
    }

    const scored = candidates
      .map((job) => ({
        job,
        ...this.scoreJob(job, taste, homeDivision, profile),
      }))
      .filter((row) => row.fit >= MIN_FIT && row.reasons.length > 0)
      // Ties broken by recency, so an unchanging list does not calcify.
      .sort(
        (a, b) =>
          b.fit - a.fit || b.job.createdAt.getTime() - a.job.createdAt.getTime(),
      )
      .slice(0, limit);

    return { scored, basis };
  }
}
