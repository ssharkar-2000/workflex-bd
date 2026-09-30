import { z } from 'zod';

/**
 * Which side of a job the person being reviewed was on.
 *
 * One account is both in this product — it looks for work and it hires — so
 * a rating is meaningless without saying which of the two it is about. A
 * five-star worker who is a difficult employer is two different facts.
 */
export const reviewRoleSchema = z.enum(['WORKER', 'RECRUITER']);
export type ReviewRole = z.infer<typeof reviewRoleSchema>;

export const reviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  onTime: z.boolean().nullable(),
  wouldWorkAgain: z.boolean().nullable(),
  subjectRole: reviewRoleSchema,
  createdAt: z.string(),
  /** The other person in the exchange, as the reader needs to see them. */
  counterpart: z.object({
    id: z.string().uuid(),
    name: z.string(),
    publicId: z.string(),
  }),
  job: z.object({
    id: z.string().uuid(),
    title: z.string(),
  }),
});
export type Review = z.infer<typeof reviewSchema>;

/**
 * The figures at the top of the ratings screen, for one role.
 *
 * Every one is counted from rows: ratings from reviews, jobs from
 * applications that were accepted. Rates are null rather than zero when
 * nobody has answered that question yet — "0% on time" and "nobody said" are
 * very different things to show someone about themselves.
 */
export const ratingSummarySchema = z.object({
  role: reviewRoleSchema,
  average: z.number().nullable(),
  count: z.number().int().nonnegative(),
  /** How many gave each score, 1 through 5. */
  distribution: z.record(z.enum(['1', '2', '3', '4', '5']), z.number().int().nonnegative()),
  jobsCompleted: z.number().int().nonnegative(),
  /** Percentages, or null when no review answered that question. */
  onTimeRate: z.number().int().nullable(),
  wouldWorkAgainRate: z.number().int().nullable(),
  /**
   * What reviewers keep mentioning, most common first — drawn from the words
   * in the reviews themselves, not generated.
   */
  themes: z.array(z.object({ theme: z.string(), mentions: z.number().int().positive() })),
});
export type RatingSummary = z.infer<typeof ratingSummarySchema>;

export const ratingsPageSchema = z.object({
  summary: ratingSummarySchema,
  received: z.array(reviewSchema),
  given: z.array(reviewSchema),
});
export type RatingsPage = z.infer<typeof ratingsPageSchema>;

export const createReviewSchema = z.object({
  jobId: z.string().uuid(),
  /** Who is being reviewed. */
  subjectId: z.string().uuid(),
  subjectRole: reviewRoleSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional().or(z.literal('')),
  onTime: z.boolean().optional(),
  wouldWorkAgain: z.boolean().optional(),
});
export type CreateReviewDto = z.output<typeof createReviewSchema>;
export type CreateReviewInput = z.input<typeof createReviewSchema>;
