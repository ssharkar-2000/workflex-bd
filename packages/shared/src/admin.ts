import { z } from 'zod';
import {
  accountTypeSchema,
  documentAnalysisSchema,
  documentKindSchema,
  kycStatusSchema,
} from './onboarding';

// --- admin auth ---
// Deliberately not `bdPhoneSchema` + OTP: an admin is a distinct identity
// (see the Admin model), signed in with email + password. The reserved-domain
// rule that makes an admin email unmistakable is enforced server-side, not
// here — the client only needs "looks like an email" to build a usable form.

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(72),
});
export type AdminLoginInput = z.input<typeof adminLoginSchema>;
export type AdminLoginDto = z.output<typeof adminLoginSchema>;

export const adminSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});
export type Admin = z.infer<typeof adminSchema>;

/** No refresh token — admin sessions just re-authenticate after ADMIN_JWT_TTL. */
export const adminAuthTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  admin: adminSchema,
});
export type AdminAuthTokens = z.infer<typeof adminAuthTokensSchema>;

// --- dashboard ---

/**
 * The eight figures on the admin home screen. Counts the portal can answer
 * truthfully today; revenue stays null until the payments module exists,
 * because a fabricated zero reads as "no money" rather than "not built yet".
 */
export const adminDashboardSchema = z.object({
  totalWorkers: z.number().int().nonnegative(),
  employers: z.number().int().nonnegative(),
  activeJobs: z.number().int().nonnegative(),
  pendingVerification: z.number().int().nonnegative(),
  totalRevenue: z.number().nullable(),
  monthlyRevenue: z.number().nullable(),
  onlineUsers: z.number().int().nonnegative(),
  fraudAlerts: z.number().int().nonnegative(),
  /** Recent sign-ups, newest first, for the activity list under the tiles. */
  recentSignups: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string(),
      accountType: accountTypeSchema.nullable(),
      verificationLevel: z.number().int(),
      createdAt: z.string(),
    }),
  ),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

// --- people directory ---

export const adminUserRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  accountType: accountTypeSchema.nullable(),
  verificationLevel: z.number().int(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  kycStatus: kycStatusSchema,
  companyName: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export const adminUserListSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  rows: z.array(adminUserRowSchema),
});
export type AdminUserList = z.infer<typeof adminUserListSchema>;

/** Tabs on the Workers screen map straight onto this. */
export const adminUserFilterSchema = z.enum([
  'ALL',
  'VERIFIED',
  'PENDING',
  'SUSPENDED',
]);
export type AdminUserFilter = z.infer<typeof adminUserFilterSchema>;

export const adminUserQuerySchema = z.object({
  filter: adminUserFilterSchema.default('ALL'),
  /** Matches name or phone. */
  search: z.string().trim().max(80).optional(),
  /** INDIVIDUAL vs COMPANY splits workers from employers. */
  accountType: accountTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminUserQuery = z.output<typeof adminUserQuerySchema>;

export const setUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  /** Required when suspending — the person deserves to know why. */
  reason: z.string().trim().max(500).optional(),
});
export type SetUserStatusDto = z.output<typeof setUserStatusSchema>;

/**
 * Mirrors KycReviewService.queue() in the API. Kept intentionally close to
 * that shape rather than reusing UploadedDocument — the reviewer needs the
 * applicant and company context alongside each document, the applicant's own
 * status view does not.
 */
export const kycQueueItemSchema = z.object({
  id: z.string(),
  accountType: accountTypeSchema,
  submittedAt: z.string(),
  waitingHours: z.number().int().nonnegative(),
  applicant: z.object({
    userId: z.string(),
    phone: z.string(),
    name: z.string(),
    address: z.string().nullable(),
    designation: z.string().nullable(),
    email: z.string().nullable(),
    emailVerified: z.boolean(),
    company: z
      .object({
        name: z.string(),
        registrationNumber: z.string().nullable(),
        tin: z.string().nullable(),
        tradeLicenseNo: z.string().nullable(),
      })
      .nullable(),
    documents: z.array(
      z.object({
        kind: documentKindSchema,
        analysis: documentAnalysisSchema.nullable(),
      }),
    ),
  }),
});
export type KycQueueItem = z.infer<typeof kycQueueItemSchema>;

export const kycQueueResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  submissions: z.array(kycQueueItemSchema),
});
export type KycQueueResponse = z.infer<typeof kycQueueResponseSchema>;

export const kycApproveResponseSchema = z.object({
  id: z.string(),
  status: z.literal('APPROVED'),
  verificationLevel: z.number(),
});

export const kycRejectResponseSchema = z.object({
  id: z.string(),
  status: z.literal('REJECTED'),
  reason: z.string(),
});

/** Only ever populated when SMS_PROVIDER is a dev provider (file/console). */
export const smsOutboxResponseSchema = z.object({
  warning: z.string(),
  messages: z.array(
    z.object({
      phone: z.string(),
      maskedPhone: z.string(),
      code: z.string().nullable(),
      sentAt: z.string(),
    }),
  ),
});
export type SmsOutboxResponse = z.infer<typeof smsOutboxResponseSchema>;
