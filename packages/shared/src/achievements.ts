import { z } from 'zod';

/**
 * Badges earned from the record.
 *
 * Every badge here corresponds to something the platform can prove: shifts
 * completed, attendance, ratings from people who hired them, tests sat,
 * credentials signed by an institution. None is awarded for signing up,
 * filling in a field, or opening the app on consecutive days — a badge
 * somebody got for completing a profile devalues the one they got for
 * turning up to twenty shifts, and both end up meaning nothing.
 */

export const badgeKeySchema = z.enum([
  'RELIABLE_WORKER',
  'SEASONED',
  'TOP_RATED',
  'ON_TIME',
  'NEVER_MISSED',
  'FAST_LEARNER',
  'TOP_SCORE',
  'SKILL_BUILDER',
  'VERIFIED_CREDENTIAL',
]);
export type BadgeKey = z.infer<typeof badgeKeySchema>;

export const badgeSchema = z.object({
  key: badgeKeySchema,
  /** When the qualifying thing happened, not when the badge was computed. */
  earnedAt: z.string(),
  /** The number behind it — shifts, reviews, a percentage — shown on the card. */
  count: z.number().int().nonnegative(),
});
export type Badge = z.infer<typeof badgeSchema>;

export const achievementsSchema = z.object({
  badges: z.array(badgeSchema),
  /** Not yet earned, with the distance to go. */
  locked: z.array(
    z.object({
      key: badgeKeySchema,
      have: z.number().int().nonnegative(),
      need: z.number().int().positive(),
    }),
  ),
  stats: z.object({
    completedJobs: z.number().int().nonnegative(),
    /** Null until there is any attendance to compute it from. */
    onTimeRate: z.number().int().nullable(),
    avgRating: z.number().nullable(),
    testsTaken: z.number().int().nonnegative(),
    credentials: z.number().int().nonnegative(),
  }),
});
export type Achievements = z.infer<typeof achievementsSchema>;
