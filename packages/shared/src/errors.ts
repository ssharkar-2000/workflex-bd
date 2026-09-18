import { z } from 'zod';

/**
 * Stable machine-readable error codes. The mobile app switches on these,
 * never on message text — messages get translated to Bangla client-side.
 */
export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',

  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_COOLDOWN: 'OTP_COOLDOWN',
  /** The gateway refused or could not be reached — retrying is reasonable. */
  SMS_DELIVERY_FAILED: 'SMS_DELIVERY_FAILED',

  ONBOARDING_INCOMPLETE: 'ONBOARDING_INCOMPLETE',
  ONBOARDING_ALREADY_SUBMITTED: 'ONBOARDING_ALREADY_SUBMITTED',
  UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',
  UPLOAD_INVALID_TYPE: 'UPLOAD_INVALID_TYPE',

  EMAIL_IN_USE: 'EMAIL_IN_USE',
  /** Ends in the domain reserved for admin accounts — not available to users. */
  EMAIL_RESERVED: 'EMAIL_RESERVED',
  EMAIL_CODE_INVALID: 'EMAIL_CODE_INVALID',
  EMAIL_CODE_EXPIRED: 'EMAIL_CODE_EXPIRED',
  EMAIL_COOLDOWN: 'EMAIL_COOLDOWN',
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',

  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',

  /** Deliberately one code for both a wrong phone and a wrong password. */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** Account exists but predates passwords — sign in with an SMS code. */
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',

  /** Too many of this account's support requests are still awaiting a reply. */
  TOO_MANY_OPEN_TICKETS: 'TOO_MANY_OPEN_TICKETS',

  /** Too many of this account's reports are still awaiting review. */
  TOO_MANY_OPEN_REPORTS: 'TOO_MANY_OPEN_REPORTS',

  /** Posting as a company needs an approved trade licence (level 2). */
  COMPANY_VERIFICATION_REQUIRED: 'COMPANY_VERIFICATION_REQUIRED',

  /** The posting was closed or its deadline passed before applying. */
  JOB_CLOSED: 'JOB_CLOSED',
  /** You cannot apply to a posting you created. */
  CANNOT_APPLY_OWN_JOB: 'CANNOT_APPLY_OWN_JOB',

  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  /** Action needs a higher verification level; `details.required` says which. */
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  /** Field-level messages for form errors, keyed by field path. */
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
