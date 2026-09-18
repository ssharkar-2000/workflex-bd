import { z } from 'zod';

/**
 * The counts and completeness figures the dashboard shows at a glance.
 *
 * One endpoint rather than five: the screen needs applications, postings,
 * applicants and saved jobs together, and asking for each separately made the
 * dashboard four round trips deep on a connection that is often a phone on
 * mobile data.
 *
 * Every number here is derived from a real row. Where the design called for a
 * figure this product does not yet record — a wallet balance, an average
 * rating, hours worked — the field is absent rather than defaulted, because a
 * zero would be read as "you have earned nothing" instead of "we do not track
 * this yet".
 */

/** One thing the person could do to make their profile more complete. */
export const profileGapSchema = z.enum([
  'PHOTO',
  'EMAIL',
  'NID_VERIFIED',
  'CV',
  'NAME',
]);
export type ProfileGap = z.infer<typeof profileGapSchema>;

export const profileStrengthSchema = z.object({
  /** 0–100, from the checks below rather than an arbitrary formula. */
  percent: z.number().int().min(0).max(100),
  /** What is still missing, so the screen can say what to do next. */
  missing: z.array(profileGapSchema),
});
export type ProfileStrength = z.infer<typeof profileStrengthSchema>;

export const dashboardSummarySchema = z.object({
  profileStrength: profileStrengthSchema,

  /** Work this account is looking for. */
  seeking: z.object({
    applications: z.number().int().nonnegative(),
    /** Applications not yet rejected or withdrawn — still live. */
    activeApplications: z.number().int().nonnegative(),
    /** Applications an employer has moved to their shortlist. */
    shortlisted: z.number().int().nonnegative(),
    savedJobs: z.number().int().nonnegative(),
  }),

  /** Work this account is offering. */
  hiring: z.object({
    jobsPosted: z.number().int().nonnegative(),
    openJobs: z.number().int().nonnegative(),
    /** People waiting on a decision across every posting. */
    applicants: z.number().int().nonnegative(),
    /** Of those, the ones this account has already shortlisted. */
    shortlisted: z.number().int().nonnegative(),
  }),

  /** Unread announcements, for the bell and the preview list. */
  unreadNotifications: z.number().int().nonnegative(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
