import { z } from 'zod';
import { jobCategorySchema } from './job-categories';
import { jobDurationSchema, jobTypeSchema, paymentTypeSchema } from './jobs';

/**
 * A job post, written from one plain sentence.
 *
 * "Need someone to help my elderly mother for 3 hours tomorrow" is how people
 * actually describe work. The posting form asks for a category, a job type, a
 * duration, a payment type and a pay range — eleven decisions before anyone
 * can be hired, and every one of them is a place to give up. This turns the
 * sentence into those answers and hands them to the form, filled in.
 *
 * What it does not do is post anything. Every field comes back editable and
 * the person presses the button themselves: this guesses, and a guess that
 * publishes itself is a job advert somebody did not write.
 */

export const jobDraftRequestSchema = z.object({
  /** What the employer typed, in their own words, in either language. */
  text: z.string().trim().min(8).max(1000),
  /** Where the work is, when the app already knows. */
  location: z.string().trim().max(160).optional().or(z.literal('')),
  language: z.enum(['en', 'bn']).optional(),
});
export type JobDraftRequestDto = z.output<typeof jobDraftRequestSchema>;
export type JobDraftRequestInput = z.input<typeof jobDraftRequestSchema>;

export const jobDraftSchema = z.object({
  title: z.string(),
  /** Null when the sentence does not say enough to place it. */
  category: jobCategorySchema.nullable(),
  description: z.string(),
  location: z.string(),

  jobType: jobTypeSchema.nullable(),
  duration: jobDurationSchema.nullable(),
  /** Hours of work, when a number of hours was actually stated. */
  hours: z.number().int().positive().nullable(),
  /**
   * The day the work starts, as a plain date (YYYY-MM-DD), resolved against
   * the employer's own today — "tomorrow" is only a date if you know when it
   * was said.
   */
  startsOn: z.string().nullable(),
  /** "Tomorrow, 3 hours" — the timing as a person would read it back. */
  whenText: z.string(),

  /** What the work needs. Plain words, not a taxonomy. */
  skills: z.array(z.string()),

  paymentType: paymentTypeSchema.nullable(),
  /** Taka, whole units. Null when there is nothing to base a figure on. */
  payMin: z.number().int().nonnegative().nullable(),
  payMax: z.number().int().nonnegative().nullable(),
  /**
   * Where the pay range came from, in one line — "from 14 similar jobs posted
   * here" or "nothing similar posted yet, so this is a guess". A number with
   * no source behind it is one nobody should trust.
   */
  payBasis: z.string().nullable(),

  /**
   * Everything that was filled in without being said. Shown to the employer
   * before they post, because a guess presented as a fact is how somebody
   * ends up advertising the wrong hours.
   */
  assumptions: z.array(z.string()),

  /** "written" means a model read the sentence; "assembled" means rules did. */
  source: z.enum(['written', 'assembled']),
});
export type JobDraft = z.infer<typeof jobDraftSchema>;
