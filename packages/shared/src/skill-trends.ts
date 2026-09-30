import { z } from 'zod';
import { jobCategorySchema } from './job-categories';

/**
 * Which skills employers are asking for more of than they were.
 *
 * Counted from the platform's own postings: every job put up in the last
 * sixty days is scanned for the vocabulary CVs actually use, and the last
 * thirty days are set against the thirty before them. Nothing is forecast.
 * "Rising" here means more postings named it this month than last, which is
 * a fact about what has already been advertised, not a prediction about what
 * will be.
 *
 * The point of it is the next screen along. A worker who learns that
 * deliveries are asking for smartphone navigation, or that wiring jobs now
 * want safety certification, can do something about it in the Learning Lab
 * this week. A trend nobody can act on is decoration.
 */

/** Which way a skill has moved, and whether it moved enough to say so. */
export const trendDirectionSchema = z.enum(['NEW', 'RISING', 'STEADY', 'FALLING']);
export type TrendDirection = z.infer<typeof trendDirectionSchema>;

export const skillTrendSchema = z.object({
  /** The term as it appears in postings and CVs, lowercased. */
  skill: z.string(),
  /** The kind of work it belongs to, for grouping and for the course search. */
  category: jobCategorySchema,

  /** Postings naming it in the last 30 days. */
  thisMonth: z.number().int().nonnegative(),
  /** Postings naming it in the 30 days before that. */
  lastMonth: z.number().int().nonnegative(),
  /** Percentage change, rounded. Null when it is new and there is no base. */
  changePct: z.number().nullable(),
  direction: trendDirectionSchema,

  /**
   * Weekly counts, oldest first, over the whole sixty days.
   *
   * Eight buckets, drawn as a small bar chart. A month-on-month number can
   * hide a single busy week, and the shape says which of the two it is.
   */
  weekly: z.array(z.number().int().nonnegative()),

  /** It is already on this person's CV. */
  onYourCv: z.boolean(),
  /**
   * It belongs to a kind of work this person's CV points at, so the trend is
   * about jobs they could plausibly apply for.
   */
  inYourField: z.boolean(),
});
export type SkillTrend = z.infer<typeof skillTrendSchema>;

export const skillTrendsSchema = z.object({
  /** Postings counted in each half of the window. */
  thisMonthJobs: z.number().int().nonnegative(),
  lastMonthJobs: z.number().int().nonnegative(),

  /** Everything that cleared the noise floor, strongest move first. */
  trends: z.array(skillTrendSchema),
  /** Rising, and in this person's field. What the screen leads with. */
  forYou: z.array(skillTrendSchema),
  /** Rising, in their field, and not yet on their CV. The Learning Lab list. */
  toLearn: z.array(skillTrendSchema),

  /** Two or three sentences over the whole picture. */
  insight: z.string(),
  source: z.enum(['written', 'assembled']),
  /**
   * True when there are too few postings in the window to compare.
   *
   * Shown rather than hidden: a trend drawn from nine postings is a number,
   * not a signal, and somebody deciding what to spend a fortnight learning
   * deserves to know which of the two they are looking at.
   */
  thin: z.boolean(),
});
export type SkillTrends = z.infer<typeof skillTrendsSchema>;
