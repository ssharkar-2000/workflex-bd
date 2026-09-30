import { z } from 'zod';

/**
 * Drafting a CV from what the platform already knows about somebody.
 *
 * The input is deliberately small: this is not a chat with a model, it is a
 * request to arrange facts the account already holds into the form an
 * employer expects to read. Everything the model returns is a suggestion the
 * person edits — nothing is saved on their behalf.
 */

/** One job, school or certificate, as the builder stores it. */
export const cvEntrySchema = z.object({
  title: z.string(),
  org: z.string(),
  place: z.string(),
  from: z.string(),
  to: z.string(),
  /** One line per point; the builder renders these as bullets. */
  detail: z.string(),
});
export type CvEntry = z.infer<typeof cvEntrySchema>;

export const generatedCvSchema = z.object({
  /** Two or three sentences, written in the first person without "I". */
  summary: z.string(),
  headline: z.string(),
  experience: z.array(cvEntrySchema),
  education: z.array(cvEntrySchema),
  certificates: z.array(cvEntrySchema),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
});
export type GeneratedCv = z.infer<typeof generatedCvSchema>;

export const cvDraftResultSchema = z.object({
  cv: generatedCvSchema,
  /**
   * How it was produced. "written" means a model arranged and phrased it;
   * "assembled" means the model is off and this is the account's own stored
   * details laid out, with nothing invented. The screen says which, because
   * a person editing their own CV should know whether a machine phrased it.
   */
  source: z.enum(['written', 'assembled']),
  /**
   * What the draft was built from, so the person can see why it says what it
   * says — and what to fill in to get a better one.
   */
  usedProfile: z.boolean(),
  usedCvUpload: z.boolean(),
  usedWorkHistory: z.boolean(),
});
export type CvDraftResult = z.infer<typeof cvDraftResultSchema>;

export const generateCvSchema = z.object({
  /**
   * The kind of work this CV is for. Without it the draft is general; with
   * it the summary and the ordering lean towards that work.
   */
  targetRole: z.string().trim().max(120).optional().or(z.literal('')),
  /** Which language to write in. Defaults to the account's own. */
  language: z.enum(['en', 'bn']).optional(),
  /**
   * What the person has already typed into the builder. Anything here is
   * kept as their own words and worked around, never overwritten.
   */
  existing: generatedCvSchema.partial().optional(),
});
export type GenerateCvDto = z.output<typeof generateCvSchema>;
export type GenerateCvInput = z.input<typeof generateCvSchema>;

/**
 * Rewriting one part of the CV instead of the whole thing.
 *
 * Drafting everything is the right first move on an empty builder and the
 * wrong one afterwards: once somebody has written three sections by hand, a
 * button that replaces all of them is a button nobody presses. These two ask
 * for exactly the piece the person is looking at.
 */
export const cvSummaryRequestSchema = z.object({
  /** The job title this CV is for. Without it the summary stays general. */
  headline: z.string().trim().max(120).optional().or(z.literal('')),
  years: z.number().int().min(0).max(60).optional(),
  skills: z.array(z.string().trim().max(60)).max(30).optional(),
  language: z.enum(['en', 'bn']).optional(),
  /**
   * Press again for another phrasing of the same facts. The first draft of a
   * sentence about yourself is rarely the one you keep.
   */
  variant: z.number().int().min(0).max(999).optional(),
});
export type CvSummaryDto = z.output<typeof cvSummaryRequestSchema>;
export type CvSummaryInput = z.input<typeof cvSummaryRequestSchema>;

export const cvSummaryResultSchema = z.object({
  summary: z.string(),
  source: z.enum(['written', 'assembled']),
});
export type CvSummaryResult = z.infer<typeof cvSummaryResultSchema>;

export const cvBulletsRequestSchema = z.object({
  /** The job these points are for; without it there is nothing to write about. */
  role: z.string().trim().min(1).max(120),
  org: z.string().trim().max(120).optional().or(z.literal('')),
  skills: z.array(z.string().trim().max(60)).max(30).optional(),
  language: z.enum(['en', 'bn']).optional(),
});
export type CvBulletsDto = z.output<typeof cvBulletsRequestSchema>;
export type CvBulletsInput = z.input<typeof cvBulletsRequestSchema>;

export const cvBulletsResultSchema = z.object({
  /** One line per point, for the builder to put in the detail box. */
  bullets: z.array(z.string()),
  source: z.enum(['written', 'assembled']),
});
export type CvBulletsResult = z.infer<typeof cvBulletsResultSchema>;
