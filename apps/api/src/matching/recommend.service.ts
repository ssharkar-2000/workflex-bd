import { Injectable } from '@nestjs/common';
import type { CvProfile, Job } from '@prisma/client';
import type {
  RecommendationFactor,
  RecommendationReason,
} from '@workflex/shared';
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
 * A suggestion has to clear this to be shown, as a percentage of what this
 * particular person's signals could possibly award.
 *
 * Measured against the achievable maximum rather than a flat 100, because the
 * four signals are not all available to everyone. Somebody who has uploaded a
 * CV but never saved a job can only earn the skills weight — 40 — so a fixed
 * threshold of 25 silently demanded a 62% CV match from them while asking far
 * less of a user with history. Tested against a real CV that hid 16 of the 18
 * genuinely relevant postings.
 *
 * Normalising also makes the number on the card mean something consistent:
 * "how well this fits, given what is known about you", rather than a fraction
 * of a total the person could never reach.
 */
const MIN_FIT = 35;

/**
 * How much of an axis's weight must be earned before it is offered as a reason.
 *
 * A card with no reason is not shown at all, so this gate is what actually
 * decides what surfaces — it was previously set at half the skills weight in
 * one branch and left implicit everywhere else, which made it stricter than
 * MIN_FIT and quietly overrode it.
 */
const REASON_SHARE = 0.35;

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
  ): {
    fit: number;
    reasons: RecommendationReason[];
    factors: RecommendationFactor[];
  } {
    const reasons: RecommendationReason[] = [];
    let fit = 0;
    let cvFieldEarned = 0;

    // Each axis records what it earned out of what it could, so the card can
    // show the same arithmetic the ranking used rather than a second estimate.
    const factors: RecommendationFactor[] = [];
    const record = (
      signal: RecommendationReason,
      earned: number,
      possible: number,
      matched: number | null = null,
      outOf: number | null = null,
    ) => {
      factors.push({
        signal,
        percent: possible > 0 ? Math.round((earned / possible) * 100) : 0,
        matched,
        outOf,
      });
    };

    // --- skills, borrowed from the CV matcher rather than reimplemented ---
    if (profile) {
      const match = this.matcher.score(profile, job);
      fit += Math.round((match.score / 100) * WEIGHTS.skills);

      // The reason is drawn from the matcher's *skills* axis, not its blended
      // total. The total folds in experience and category, so a posting could
      // earn most of its score from being in the right field with no skill
      // overlap at all — and be labelled "matches your skills", which would be
      // a claim the evidence did not support.
      const skillAxis = match.reasons.find((r) => r.key === 'skills');
      if (skillAxis && skillAxis.earned >= skillAxis.possible * REASON_SHARE) {
        reasons.push('SKILLS');
      }
      if (skillAxis) {
        // Counted against the CV's own skills, which is the denominator a
        // reader can check — "5 of 31" is a fact, "83%" is an assertion.
        record(
          'SKILLS',
          skillAxis.earned,
          skillAxis.possible,
          match.matchedSkills.length,
          profile.skills.length,
        );
      }

      // A CV states the person's field, which is a preference in exactly the
      // way a saved job is. Without this, someone who has uploaded a CV but
      // never saved anything had one usable signal where they should have had
      // two, and 16 of the 18 postings genuinely in their field were dropped
      // for having no reason to show.
      if (profile.categories.includes(job.category)) {
        cvFieldEarned = Math.round(WEIGHTS.preference * 0.6);
        fit += cvFieldEarned;
        reasons.push('PREFERENCE');
      }
    }

    // --- location ---
    // District is the meaningful unit for a commute; division is the coarse
    // fallback, worth less because a division can be a day's travel across.
    // Each is scaled by how often the person has chosen it before.
    const districtPull = strength(taste.districts, job.district);
    const divisionPull = strength(taste.divisions, job.division);

    let locationEarned = 0;
    if (districtPull > 0) {
      locationEarned = Math.round(WEIGHTS.location * districtPull);
      reasons.push('LOCATION');
    } else if (divisionPull > 0) {
      locationEarned = Math.round(WEIGHTS.location * 0.6 * divisionPull);
      reasons.push('LOCATION');
    } else if (job.division && job.division === homeDivision) {
      // No history to go on, so this comes from the registered address. Worth
      // less than a demonstrated choice, because it is an inference.
      locationEarned = Math.round(WEIGHTS.location * 0.5);
      reasons.push('LOCATION');
    }
    fit += locationEarned;
    record('LOCATION', locationEarned, WEIGHTS.location);

    // --- availability ---
    const hoursPull = strength(taste.workingTimes, job.workingTime);
    const hoursEarned = Math.round(WEIGHTS.availability * hoursPull);
    if (hoursPull > 0) {
      fit += hoursEarned;
      reasons.push('AVAILABILITY');
    }
    record('AVAILABILITY', hoursEarned, WEIGHTS.availability);

    // --- preferences: what kind of work ---
    const categoryPull = strength(taste.categories, job.category);
    const typePull = strength(taste.jobTypes, job.jobType);

    let prefEarned = 0;
    if (categoryPull > 0) {
      prefEarned = Math.round(WEIGHTS.preference * categoryPull);
      fit += prefEarned;
      reasons.push('PREFERENCE');
    } else if (typePull > 0) {
      prefEarned = Math.round(WEIGHTS.preference * 0.5 * typePull);
      fit += prefEarned;
      reasons.push('PREFERENCE');
    }
    // Capped at the axis weight: the CV's field and a saved-job history can
    // both fire, and a factor reading over 100% would be nonsense.
    record(
      'PREFERENCE',
      Math.min(WEIGHTS.preference, cvFieldEarned + prefEarned),
      WEIGHTS.preference,
    );

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

    return {
      fit: Math.min(100, fit),
      reasons: [...new Set(reasons)],
      factors,
    };
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
      preferences:
        taste.categories.size > 0 ||
        taste.jobTypes.size > 0 ||
        (profile?.categories.length ?? 0) > 0,
    };

    // Nothing known about this person: say so instead of guessing.
    if (!basis.skills && !taste.any && !homeDivision) {
      return { scored: [], basis };
    }

    // The most any job could score for this person, given which signals they
    // actually have. Never zero: the guard above returns early when nothing is
    // known, so at least one term is always available here.
    const achievable =
      (basis.skills ? WEIGHTS.skills : 0) +
      (basis.location ? WEIGHTS.location : 0) +
      (basis.availability ? WEIGHTS.availability : 0) +
      (basis.preferences ? WEIGHTS.preference : 0);

    const scored = candidates
      .map((job) => {
        const raw = this.scoreJob(job, taste, homeDivision, profile);
        return {
          job,
          reasons: raw.reasons,
          factors: raw.factors,
          // Rescaled to the achievable maximum, so the percentage shown means
          // the same thing whether the system knows one thing about someone or
          // all four.
          fit: Math.min(
            100,
            Math.round((raw.fit / Math.max(1, achievable)) * 100),
          ),
        };
      })
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
