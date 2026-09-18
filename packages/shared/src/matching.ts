import { z } from 'zod';
import { jobCategorySchema } from './job-categories';

/**
 * CV understanding and job matching.
 *
 * The split matters: a language model reads the CV *once* and turns prose into
 * a structured profile. Everything after that — comparing that profile against
 * a hundred and fifty job postings, on every scroll — is arithmetic over the
 * stored fields. Asking a model per listing would cost a call per card and
 * still be less explainable than counting overlapping skills.
 */

export const cvProfileSchema = z.object({
  /** Lowercased and de-duplicated, so the matcher can intersect directly. */
  skills: z.array(z.string()),
  /** Null when the CV gives nothing a reader could turn into a number. */
  yearsExperience: z.number().int().min(0).max(60).nullable(),
  categories: z.array(jobCategorySchema),
  titles: z.array(z.string()),
  summary: z.string().nullable(),
  parsedAt: z.string(),
});
export type CvProfile = z.infer<typeof cvProfileSchema>;

/** What the account currently has, for the CV screen. */
export const cvStatusSchema = z.object({
  hasCv: z.boolean(),
  /** Null until a CV has been uploaded and successfully parsed. */
  profile: cvProfileSchema.nullable(),
  /**
   * False when CV_PARSER is off on the server. The app hides match scores
   * entirely rather than showing every job as unmatched, which would read as
   * "you are a bad fit for everything".
   */
  parsingEnabled: z.boolean(),
});
export type CvStatus = z.infer<typeof cvStatusSchema>;

export const matchBandSchema = z.enum(['STRONG', 'GOOD', 'FAIR', 'WEAK']);
export type MatchBand = z.infer<typeof matchBandSchema>;

export const jobMatchSchema = z.object({
  /** 0–100. Bands are what the UI shows; the number is for ordering. */
  score: z.number().int().min(0).max(100),
  band: matchBandSchema,
  /**
   * The specific skills that matched. Shown to the user, because a score
   * without a reason is a number nobody can act on or argue with.
   */
  matchedSkills: z.array(z.string()),
  /** Which of the three axes contributed, for the detail screen's breakdown. */
  reasons: z.array(
    z.object({
      key: z.enum(['skills', 'experience', 'category']),
      earned: z.number().int(),
      possible: z.number().int(),
    }),
  ),
});
export type JobMatch = z.infer<typeof jobMatchSchema>;
