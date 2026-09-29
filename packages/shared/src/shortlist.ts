import { z } from 'zod';

/**
 * The AI shortlist: who to interview, out of everyone who applied.
 *
 * A popular posting draws forty applications, and a recruiter reading forty
 * CVs at eleven at night reads the first six properly and skims the rest.
 * That is the problem this solves — not the reading, the *ordering*, so that
 * the six read properly are the six worth reading.
 *
 * Every percentage here is arithmetic over things the platform can check:
 * which of the job's stated requirements appear in the CV, years of
 * experience against the band the posting asks for, whether there is a CV
 * and an intro video to review at all, and whether the account is verified.
 * A model is not asked to produce the number. It is asked to read the
 * candidate and say, in one line, what the number does not capture — and its
 * reservations are shown beside its praise, because a shortlist that only
 * ever argues in favour is one a recruiter stops checking.
 */

/** One axis of the score, shown so the total can be argued with. */
export const matchAxisSchema = z.object({
  key: z.enum(['skills', 'experience', 'cv', 'intro', 'standing']),
  earned: z.number().int().nonnegative(),
  possible: z.number().int().positive(),
});
export type MatchAxis = z.infer<typeof matchAxisSchema>;

export const shortlistCandidateSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  verified: z.boolean(),
  status: z.enum(['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
  appliedAt: z.string(),

  /** 0–100. What the recruiter sees as the match percentage. */
  score: z.number().int().min(0).max(100),
  axes: z.array(matchAxisSchema),

  /** The job's own requirement words this CV actually contains. */
  matchedSkills: z.array(z.string()),
  /** Requirement words it does not. The half recruiters ask for first. */
  missingSkills: z.array(z.string()),

  /** Years the CV evidences, or null when it says nothing countable. */
  yearsExperience: z.number().int().nullable(),
  /** Roles the person has actually held. */
  titles: z.array(z.string()),
  /** What the CV parser understood, shown so a wrong reading is visible. */
  summary: z.string().nullable(),

  hasCv: z.boolean(),
  hasIntro: z.boolean(),
  /** What they wrote when applying. */
  message: z.string().nullable(),

  /** One line for them. */
  why: z.string(),
  /** One line against them, or what is still unknown. Never empty by design. */
  reservation: z.string(),
});
export type ShortlistCandidate = z.infer<typeof shortlistCandidateSchema>;

export const shortlistSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string(),
  /** Everyone whose application is live — the denominator of the ranking. */
  considered: z.number().int().nonnegative(),
  /** Withdrawn and rejected applications, excluded and counted separately. */
  excluded: z.number().int().nonnegative(),
  /**
   * How many of those considered have no parsed CV.
   *
   * Surfaced rather than buried: these people are ranked on what little is
   * known, and a recruiter deciding who to call deserves to know that a low
   * score can mean "did not upload a CV" rather than "not suitable".
   */
  withoutCv: z.number().int().nonnegative(),
  candidates: z.array(shortlistCandidateSchema),
  /** Two or three sentences over the whole field. */
  summary: z.string(),
  source: z.enum(['written', 'assembled']),
});
export type Shortlist = z.infer<typeof shortlistSchema>;
