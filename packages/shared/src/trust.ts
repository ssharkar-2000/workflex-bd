import { z } from 'zod';

/**
 * How much this account has proved about itself.
 *
 * Distinct from profile strength, which asks "have you filled the form in".
 * This asks "what can WorkFlex BD vouch for", and the difference matters to
 * the person on the other side of a hire: a complete profile is typing, while
 * an approved NID is a document a reviewer looked at.
 *
 * Every factor below is a row in the database. Nothing here is estimated,
 * inferred from behaviour, or carried over from another platform — a trust
 * score that cannot be traced back to a record is worse than no score, because
 * it launders a guess into a number people rely on when deciding who to let
 * into their home.
 */

/**
 * The factors the score is built from.
 *
 * Named rather than numbered so the app can label each one and route to
 * wherever it is earned. Notably absent: a star rating. Nobody can rate anyone
 * on this platform yet — there is no review table and no place to leave one —
 * so a rating row would be fiction, and the one line on a trust card that
 * absolutely cannot be fiction is the one people read as "others vouch for
 * this person".
 */
export const trustFactorKindSchema = z.enum([
  /** An admin approved the NID. Verification level 1. */
  'IDENTITY',
  /** A verification selfie is on file. */
  'PHOTO',
  /** An email address exists and the code sent to it was confirmed. */
  'EMAIL',
  /** Applications an employer accepted — a track record of being chosen. */
  'HIRED',
  /** Shifts attended on time, out of shifts recorded. */
  'RELIABILITY',
  /** An approved trade licence. Verification level 2. */
  'BUSINESS',
]);
export type TrustFactorKind = z.infer<typeof trustFactorKindSchema>;

export const trustFactorSchema = z.object({
  kind: trustFactorKindSchema,
  /** Whether this factor is earned in full. */
  earned: z.boolean(),
  /** Points this factor contributed. */
  points: z.number().int().nonnegative(),
  /** Points it could contribute at most. */
  max: z.number().int().positive(),
  /**
   * The number behind the row, when there is one — times hired, percent of
   * shifts attended. Null for the factors that are simply true or false, so
   * the app shows a plain label instead of inventing a statistic.
   */
  detail: z.number().nullable(),
});
export type TrustFactor = z.infer<typeof trustFactorSchema>;

/**
 * Where the score sits, in words.
 *
 * `NEW` rather than a failing grade: an account that has just verified has not
 * done anything wrong, it has simply not done anything yet, and telling
 * someone they are untrustworthy for being new is both untrue and the fastest
 * way to lose them.
 */
export const trustBandSchema = z.enum([
  'EXCELLENT',
  'STRONG',
  'BUILDING',
  'NEW',
]);
export type TrustBand = z.infer<typeof trustBandSchema>;

export const trustScoreSchema = z.object({
  /** 0–100, after any penalty. */
  score: z.number().int().min(0).max(100),
  band: trustBandSchema,
  factors: z.array(trustFactorSchema),
  /**
   * Reports against this account that an admin upheld.
   *
   * Subtracted from the score rather than shown as a missing factor: nobody
   * earns points for not being reported, and presenting a clean record as an
   * achievement would flatter every brand-new account.
   */
  upheldReports: z.number().int().nonnegative(),
  /** Points lost to those reports, so the arithmetic on screen adds up. */
  penalty: z.number().int().nonnegative(),
});
export type TrustScore = z.infer<typeof trustScoreSchema>;
