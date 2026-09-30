import type { CvProfile, Job } from '@prisma/client';
import type { CandidateFlag } from '@workflex/shared';
import {
  SHORTLIST_WEIGHTS,
  experiencePoints,
  heldTheJob,
  mentions,
  requirementWords,
  skillPoints,
} from '../jobs/applicant-fit';

/**
 * The fewest years of experience each band on a posting asks for. "1–3 years"
 * turns away nobody who has a year; the shortlist's own scoring uses the
 * midpoint, which is right for ranking and wrong for a yes/no.
 */
export const MIN_YEARS: Record<Job['experienceLevel'], number> = {
  ENTRY: 0,
  ONE_TO_THREE: 1,
  THREE_TO_FIVE: 3,
  FIVE_PLUS: 5,
};

/** A posting has to list at least this many requirement words before "matches none of them" means anything. */
const MIN_WORDS_TO_JUDGE = 3;

export interface Assessment {
  /** False when the CV plainly fails what the posting asks for. */
  meets: boolean;
  /** 0–100, skills and experience on the shortlist's own scale. */
  fit: number;
  matched: string[];
  missing: string[];
  flags: CandidateFlag[];
  /** Set when experience is what failed. */
  needsYears: number | null;
  /** Set when the skills are what failed. */
  noSkillMatch: boolean;
}

/**
 * Does this person meet what the posting asks for, and how well?
 *
 * "Meets" is a hard no only when the CV plainly says so: stated years below
 * the band the posting asks for, or a posting that lists what it wants and a
 * CV that has none of it and never held the job. Anything that cannot be
 * checked — no parsed CV, no years stated — is not a failure; it is a flag,
 * because the employer already shortlisted this person and an unwritten CV is
 * a badly written CV, not an unqualified person. The score orders the list.
 */
export function assess(profile: CvProfile | null, job: Job): Assessment {
  const wanted = requirementWords(job);
  const matched = wanted.filter((word) => mentions(profile, word));
  const missing = wanted.filter((word) => !matched.includes(word));

  const points =
    skillPoints(matched.length, wanted.length, profile, job) +
    experiencePoints(profile?.yearsExperience ?? null, job);
  const fit = Math.round(
    (points / (SHORTLIST_WEIGHTS.skills + SHORTLIST_WEIGHTS.experience)) * 100,
  );

  const years = profile?.yearsExperience ?? null;
  const needs = MIN_YEARS[job.experienceLevel];
  const tooFewYears = years !== null && years < needs;

  const noSkillMatch =
    profile !== null &&
    wanted.length >= MIN_WORDS_TO_JUDGE &&
    matched.length === 0 &&
    !heldTheJob(profile, job);

  const flags: CandidateFlag[] = [];
  if (!profile) flags.push('NO_CV');
  else if (years === null && needs > 0) flags.push('YEARS_UNSTATED');

  return {
    meets: !tooFewYears && !noSkillMatch,
    fit: Math.max(0, Math.min(100, fit)),
    matched: matched.slice(0, 8),
    missing: missing.slice(0, 6),
    flags,
    needsYears: tooFewYears ? needs : null,
    noSkillMatch,
  };
}

interface Span {
  startsAt: Date;
  endsAt: Date;
}

/**
 * When, if ever, one of `busy` overlaps one of `windows`. Touching is not
 * overlapping: a shift ending at noon does not clash with one starting then.
 */
export function firstClash(windows: Span[], busy: Span[]): Date | null {
  let earliest: Date | null = null;
  for (const shift of busy) {
    for (const window of windows) {
      if (shift.startsAt < window.endsAt && shift.endsAt > window.startsAt) {
        if (!earliest || shift.startsAt < earliest) earliest = shift.startsAt;
      }
    }
  }
  return earliest;
}

/** Bangla numerals, as everywhere else the reader sees a number. */
export function bnDigits(value: number): string {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
