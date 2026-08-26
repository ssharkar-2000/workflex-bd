import { z } from 'zod';
import { isValidBdPhone, normalizeBdPhone } from './phone';
import { localeSchema } from './locale';
import {
  otpPurposeSchema,
  profileKindSchema,
  recruiterKindSchema,
  userStatusSchema,
  verificationLevelSchema,
} from './enums';

/**
 * These schemas are the single source of truth for the auth contract.
 * The API derives its DTOs from them and the mobile app derives its form
 * validation from them, so the two cannot drift.
 */

/** Accepts any BD format, hands downstream code a normalised +8801XXXXXXXXX. */
export const bdPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .refine(isValidBdPhone, 'Enter a valid Bangladeshi mobile number')
  .transform(normalizeBdPhone);

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

// --- POST /auth/otp/request ---

export const otpRequestSchema = z.object({
  phone: bdPhoneSchema,
  purpose: otpPurposeSchema.default('LOGIN'),
});
export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpRequestDto = z.output<typeof otpRequestSchema>;

export const otpRequestResponseSchema = z.object({
  /** Seconds until the code expires. */
  expiresIn: z.number().int().positive(),
  /** Seconds the client must wait before offering "Resend". */
  resendAfter: z.number().int().nonnegative(),
  /** Present only when SMS_PROVIDER=console, so dev can log in without a gateway. */
  devCode: z.string().optional(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

// --- POST /auth/otp/verify ---

export const otpVerifySchema = z.object({
  phone: bdPhoneSchema,
  code: otpCodeSchema,
  purpose: otpPurposeSchema.default('LOGIN'),
  /** Stable per-install id so one device's refresh token can be revoked alone. */
  deviceId: z.string().trim().min(8).max(128).optional(),
});
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
export type OtpVerifyDto = z.output<typeof otpVerifySchema>;

// --- session ---

export const authUserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  /** Null until registration is filled in — the app falls back to the number. */
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  /**
   * True once a SELFIE document exists. The image itself is fetched from
   * GET /onboarding/documents/SELFIE; this flag exists so the app knows
   * whether to attempt that request at all rather than firing a 404 on every
   * dashboard load for accounts that have not verified yet.
   */
  hasPhoto: z.boolean(),
  email: z.string().email().nullable(),
  /** Optional channel — never a substitute for phone verification. */
  emailVerified: z.boolean(),
  locale: localeSchema,
  status: userStatusSchema,
  verificationLevel: verificationLevelSchema,
  isAdmin: z.boolean(),
  /** Which profiles exist on this account — drives the role switcher. */
  profiles: z.array(profileKindSchema),
  recruiterKind: recruiterKindSchema.nullable(),
  createdAt: z.string().datetime(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Access token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authSessionSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
  /** True on the request that created the account — the app routes to onboarding. */
  isNewUser: z.boolean(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

// --- POST /auth/login ---

/**
 * Sign-in with the phone number and password set during registration.
 *
 * The password is only length-checked here, never pattern-checked: telling a
 * caller their input "does not meet the rules" at sign-in leaks which accounts
 * have weak passwords, and an existing password may predate any rule change.
 */
export const loginSchema = z.object({
  phone: bdPhoneSchema,
  password: z.string().min(1, 'Enter your password').max(72),
  deviceId: z.string().trim().min(8).max(128).optional(),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginDto = z.output<typeof loginSchema>;

// --- password reset ---

export const passwordResetRequestSchema = z.object({
  phone: bdPhoneSchema,
});
export type PasswordResetRequestInput = z.input<
  typeof passwordResetRequestSchema
>;
export type PasswordResetRequestDto = z.output<
  typeof passwordResetRequestSchema
>;

// --- POST /auth/refresh ---

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(20),
});
export type RefreshInput = z.input<typeof refreshSchema>;
export type RefreshDto = z.output<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(20).optional(),
  /** Sign out everywhere — used from Settings. */
  allDevices: z.boolean().default(false),
});
export type LogoutInput = z.input<typeof logoutSchema>;
export type LogoutDto = z.output<typeof logoutSchema>;

/** Shape of the signed JWT access-token payload. */
export const accessTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  vl: verificationLevelSchema,
  adm: z.boolean(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
