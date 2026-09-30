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

  /** The meeting is cancelled, over, not a video meeting, or its door is not open yet. */
  MEETING_NOT_JOINABLE: 'MEETING_NOT_JOINABLE',
  /** Video calls are not set up on this server (no LiveKit credentials). */
  CALLS_UNAVAILABLE: 'CALLS_UNAVAILABLE',
  /** The room is already booked for part of that time. */
  ROOM_BUSY: 'ROOM_BUSY',

  /** The posting was closed or its deadline passed before applying. */
  JOB_CLOSED: 'JOB_CLOSED',
  /** You cannot apply to a posting you created. */
  CANNOT_APPLY_OWN_JOB: 'CANNOT_APPLY_OWN_JOB',
  /** The applicant withdrew, so there is nothing left to decide. */
  APPLICATION_WITHDRAWN: 'APPLICATION_WITHDRAWN',

  /** Not enough money in the wallet for this payment or withdrawal. */
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  /**
   * The wallet holds enough, but not enough of it was earned. Only money paid
   * in by someone who hired you can be withdrawn; `details.withdrawable` says
   * how much that is.
   */
  NOT_WITHDRAWABLE: 'NOT_WITHDRAWABLE',
  /** Payments go only to someone hired (accepted) on one of your postings. */
  NOT_HIRED: 'NOT_HIRED',
  /** The payment gateway refused the request or could not be reached. */
  PAYMENT_GATEWAY_UNAVAILABLE: 'PAYMENT_GATEWAY_UNAVAILABLE',
  /** Someone got there first — the withdrawal or top-up was already dealt with. */
  ALREADY_PROCESSED: 'ALREADY_PROCESSED',

  /** The hired worker has not been marked unavailable, so there is nobody to replace. */
  HIRE_NOT_UNAVAILABLE: 'HIRE_NOT_UNAVAILABLE',
  /** That shortlisted person cannot take the place: busy, not a fit, or no longer shortlisted. */
  REPLACEMENT_NOT_ELIGIBLE: 'REPLACEMENT_NOT_ELIGIBLE',

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
