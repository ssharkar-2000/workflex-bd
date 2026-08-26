import { z } from 'zod';

/**
 * Verification is a *level*, not a role. Every gated action in the product
 * checks the level, so a user who is both a worker and a recruiter verifies once.
 *
 *   L0 phone verified    -> browse, build a profile
 *   L1 identity verified -> apply to jobs, post as an individual, get paid  (NID + selfie)
 *   L2 business verified -> post as a company, payroll                      (TIN + trade licence)
 */
export const VerificationLevel = {
  L0_PHONE: 0,
  L1_IDENTITY: 1,
  L2_BUSINESS: 2,
} as const;
export type VerificationLevel =
  (typeof VerificationLevel)[keyof typeof VerificationLevel];

export const verificationLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

/** A single account may hold both profiles; the app has a role switcher. */
export const profileKindSchema = z.enum(['WORKER', 'RECRUITER']);
export type ProfileKind = z.infer<typeof profileKindSchema>;

export const recruiterKindSchema = z.enum(['INDIVIDUAL', 'ORGANIZATION']);
export type RecruiterKind = z.infer<typeof recruiterKindSchema>;

export const userStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** Why an OTP was issued — a login code must not be replayable as a reset code. */
export const otpPurposeSchema = z.enum([
  'LOGIN',
  'PHONE_CHANGE',
  'PASSWORD_RESET',
]);
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;
