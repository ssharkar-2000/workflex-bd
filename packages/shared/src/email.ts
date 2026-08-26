import { z } from 'zod';

/**
 * Email is optional and secondary throughout. Phone + OTP is the mandatory
 * identity check; a verified email only adds a notification and recovery
 * channel and never substitutes for phone verification.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const emailCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

// --- POST /me/email ---

export const setEmailSchema = z.object({
  email: emailSchema,
});
export type SetEmailInput = z.input<typeof setEmailSchema>;
export type SetEmailDto = z.output<typeof setEmailSchema>;

export const setEmailResponseSchema = z.object({
  email: z.string(),
  expiresIn: z.number().int().positive(),
  resendAfter: z.number().int().nonnegative(),
  devCode: z.string().optional(),
});
export type SetEmailResponse = z.infer<typeof setEmailResponseSchema>;

// --- POST /me/email/verify ---

export const verifyEmailSchema = z.object({
  code: emailCodeSchema,
});
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;
export type VerifyEmailDto = z.output<typeof verifyEmailSchema>;

export const emailStatusSchema = z.object({
  email: z.string().nullable(),
  verified: z.boolean(),
  /** An address awaiting confirmation, if one has been submitted. */
  pendingEmail: z.string().nullable(),
});
export type EmailStatus = z.infer<typeof emailStatusSchema>;
