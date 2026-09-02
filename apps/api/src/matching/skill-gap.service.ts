import { Injectable } from '@nestjs/common';
import type { Job } from '@prisma/client';
import type { JobCategory, SkillPath } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { SIGNALS, mentions } from './cv-keywords';

/**
 * How many skills to suggest learning.
 *
 * Three. A list of fifteen is a syllabus nobody starts; three is a decision
 * someone can act on this week, and the next three appear as soon as one is
 * learned.
 */
const GAP_LIMIT = 3;

/**
 * A skill has to appear in at least this share of the field's postings to be
 * worth naming.
 *
 * Without a floor the list fills with terms one employer happened to type,
 * which is noise presented as a trend. At 15% a skill is being asked for by
 * roughly one employer in seven — thin, but genuinely a pattern.
 */
const MIN_DEMAND = 0.15;

/**
 * The ceiling on postings scanned.
 *
 * Every posting is tested against every term, so the work is postings × terms.
 * The newest few hundred describe what is being hired for now, which is the
 * question; older postings would dilute it with demand that has already been
 * met.
 */
const SCAN_LIMIT = 400;

@Injectable()
export class SkillGapService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything a posting could name a skill in, lowercased once. */
  private haystack(job: Job): string {
    return [job.title, job.description, job.requirements ?? '']
      .join(' ')
      .toLowerCase();
  }

  /**
   * The commonest open title in a field.
   *
   * Used as the target to be "ready for", because a field is too broad to be
   * ready for and a specific title is what a person recognises. Falls back to
   * the field's own name when postings are too varied to have a mode.
   */
  private commonestTitle(jobs: Job[], fallback: string): string {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const title = job.title.trim();
      if (title) counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    let best = fallback;
    let top = 0;
    for (const [title, n] of counts) {
      if (n > top) {
        top = n;
        best = title;
      }
    }
    return best;
  }

  /**
   * What this person should learn next, measured against live demand.
   *
   * Returns null rather than a guess whenever the evidence is missing: no
   * parsed CV means nothing to compare, and no postings in the field means
   * nothing to compare against. A card that invents a target role for someone
   * with no CV would be the most visible dishonest thing on the dashboard.
   */
  async path(userId: string): Promise<SkillPath | null> {
    const profile = await this.prisma.cvProfile.findUnique({
      where: { userId },
    });
    if (!profile || profile.categories.length === 0) return null;

    const now = new Date();

    // Which of the person's fields has the most work in it right now. Someone
    // whose CV spans IT and Creative is best advised about wherever the jobs
    // actually are.
    const byCategory = await this.prisma.job.groupBy({
      by: ['category'],
      where: {
        isOpen: true,
        category: { in: profile.categories },
        OR: [{ deadline: null }, { deadline: { gte: now } }],
      },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    const category = byCategory[0]?.category as JobCategory | undefined;
    if (!category) return null;

    const jobs = await this.prisma.job.findMany({
      where: {
        isOpen: true,
        category,
        OR: [{ deadline: null }, { deadline: { gte: now } }],
      },
      orderBy: { createdAt: 'desc' },
      take: SCAN_LIMIT,
    });
    if (jobs.length === 0) return null;

    // The vocabulary for this field only. Testing a construction CV against
    // "tensorflow" wastes work and can only produce nonsense advice.
    const vocabulary =
      SIGNALS.find((group) => group.category === category)?.terms ?? [];
    if (vocabulary.length === 0) return null;

    const texts = jobs.map((job) => this.haystack(job));
    const has = new Set(profile.skills.map((s) => s.toLowerCase()));

    // Demand: how many of the field's postings name each term.
    const demand = new Map<string, number>();
    const jobsWithTerm = new Map<string, Job[]>();

    for (const term of vocabulary) {
      const matching: Job[] = [];
      texts.forEach((text, i) => {
        if (mentions(text, term)) matching.push(jobs[i]!);
      });
      if (matching.length > 0) {
        demand.set(term, matching.length);
        jobsWithTerm.set(term, matching);
      }
    }

    // Only terms employers here actually ask for count towards readiness. A
    // skill nobody is hiring for should neither raise nor lower the score.
    const inDemand = [...demand.entries()].filter(
      ([, n]) => n / jobs.length >= MIN_DEMAND,
    );
    if (inDemand.length === 0) return null;

    const strengths = inDemand
      .filter(([term]) => has.has(term))
      .map(([term]) => term);

    const missing = inDemand.filter(([term]) => !has.has(term));

    /**
     * How many postings a skill would newly put in reach.
     *
     * Counted as postings that name the skill and that the CV currently
     * matches on nothing else in this vocabulary — the ones genuinely closed
     * off today. Counting every posting mentioning the term would inflate the
     * figure with jobs the person already qualifies for.
     */
    const unlocksFor = (term: string): number => {
      const candidates = jobsWithTerm.get(term) ?? [];
      return candidates.filter((job) => {
        const text = this.haystack(job);
        return !vocabulary.some(
          (other) => other !== term && has.has(other) && mentions(text, other),
        );
      }).length;
    };

    return {
      category,
      targetRole: this.commonestTitle(jobs, category),
      jobsConsidered: jobs.length,
      readiness: Math.round((strengths.length / inDemand.length) * 100),
      // The strongest first, so the sentence "you already have X" leads with
      // the most valuable thing they have.
      strengths: strengths
        .sort((a, b) => (demand.get(b) ?? 0) - (demand.get(a) ?? 0))
        .slice(0, 6),
      /**
       * Demand first, then what actually opens doors.
       *
       * Ordering on demand alone put a skill worth zero new jobs at the top —
       * every posting asking for it was already reachable through something
       * the CV has. Among skills employers want equally often, the one that
       * unlocks work the person cannot reach today is the better advice, and
       * it is the figure the card's closing line is built on.
       */
      gaps: missing
        .map(([term, n]) => ({
          skill: term,
          relevance: Math.round((n / jobs.length) * 100),
          unlocks: unlocksFor(term),
        }))
        .sort((a, b) => b.relevance - a.relevance || b.unlocks - a.unlocks)
        .slice(0, GAP_LIMIT),
    };
  }
}
