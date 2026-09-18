import { Injectable } from '@nestjs/common';
import type { CvProfile, Job } from '@prisma/client';
import type { JobMatch, MatchBand } from '@workflex/shared';

/**
 * Scores a parsed CV against a job posting.
 *
 * Deliberately arithmetic, not a model call. A feed page is twenty listings
 * and the catalogue is far larger; asking a model per card would cost a
 * request per row, add seconds of latency to a scroll, and produce a number
 * nobody could explain afterwards. Skill overlap, experience distance and
 * category fit are all computable from the profile the model already
 * extracted, and every one of them can be shown to the user as a reason.
 *
 * The weights are a product judgement, not a discovered truth: skills carry
 * half because they are the thing an employer actually screens on, and the
 * other two split the rest. They are constants here so they can be tuned in
 * one place once there is real hiring data to tune against.
 */
const WEIGHTS = { skills: 50, experience: 25, category: 25 } as const;

const BANDS: { min: number; band: MatchBand }[] = [
  { min: 70, band: 'STRONG' },
  { min: 45, band: 'GOOD' },
  { min: 20, band: 'FAIR' },
  { min: 0, band: 'WEAK' },
];

/** Midpoint years each posting's experience band implies. */
const LEVEL_YEARS: Record<Job['experienceLevel'], number> = {
  ENTRY: 0,
  ONE_TO_THREE: 2,
  THREE_TO_FIVE: 4,
  FIVE_PLUS: 7,
};

@Injectable()
export class MatchService {
  /**
   * Everything on the posting a skill could plausibly appear in, lowercased
   * once per job rather than per skill.
   */
  private haystack(job: Job): string {
    return [job.title, job.description, job.requirements ?? '']
      .join(' ')
      .toLowerCase();
  }

  score(profile: CvProfile, job: Job): JobMatch {
    const text = this.haystack(job);

    // --- skills ---
    // Substring rather than token equality: a CV says "ms office" and a
    // posting says "familiar with MS Office", and requiring exact tokens
    // would miss almost every real pairing. Short skills are skipped because
    // two-character fragments match everything.
    const matchedSkills = profile.skills.filter(
      (skill) => skill.length >= 3 && text.includes(skill),
    );

    /**
     * Having held the job before is the single strongest signal here, and it
     * is what an employer screens on first. Counting it as one more keyword
     * scored an electrician at just over half for a job titled "Electrician",
     * which is plainly wrong — so a title hit carries most of the axis on its
     * own and overlapping skills fill the rest.
     */
    const jobTitle = job.title.toLowerCase();
    const matchedTitle = profile.titles.find((held) => {
      const t = held.trim().toLowerCase();
      return t.length >= 3 && (jobTitle.includes(t) || t.includes(jobTitle));
    });

    // Saturating at four, not at the CV's total: someone listing forty skills
    // should not out-score a focused candidate simply for breadth.
    const skillRatio = Math.min(matchedSkills.length, 4) / 4;
    const skillPoints = Math.round(
      WEIGHTS.skills *
        (matchedTitle
          ? Math.min(1, 0.7 + skillRatio * 0.3)
          : skillRatio),
    );

    // --- experience ---
    // Distance from what the posting wants, in years. Being *over* qualified
    // is penalised at half rate — it is a weaker signal against a match than
    // being under, especially for shift work.
    const wanted = LEVEL_YEARS[job.experienceLevel];
    let experiencePoints: number;
    if (profile.yearsExperience === null) {
      // Unknown is not a failure. Half marks, so a CV that never states years
      // is not ranked below one that states too few.
      experiencePoints = Math.round(WEIGHTS.experience * 0.5);
    } else {
      const gap = profile.yearsExperience - wanted;
      const penalty = gap >= 0 ? gap * 0.5 : -gap;
      experiencePoints = Math.max(
        0,
        Math.round(WEIGHTS.experience * (1 - penalty / 6)),
      );
    }

    // --- category ---
    const categoryPoints = profile.categories.includes(job.category)
      ? WEIGHTS.category
      : 0;

    const score = Math.min(
      100,
      skillPoints + experiencePoints + categoryPoints,
    );

    return {
      score,
      band: BANDS.find((b) => score >= b.min)?.band ?? 'WEAK',
      // The title leads when it matched, because it is what earned most of
      // the score — showing only keywords would understate the reason.
      matchedSkills: (matchedTitle
        ? [matchedTitle, ...matchedSkills]
        : matchedSkills
      ).slice(0, 8),
      reasons: [
        { key: 'skills', earned: skillPoints, possible: WEIGHTS.skills },
        {
          key: 'experience',
          earned: experiencePoints,
          possible: WEIGHTS.experience,
        },
        { key: 'category', earned: categoryPoints, possible: WEIGHTS.category },
      ],
    };
  }
}
