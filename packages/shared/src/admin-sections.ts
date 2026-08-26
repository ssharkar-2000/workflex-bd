import { z } from 'zod';
import { accountTypeSchema, analysisStatusSchema, documentKindSchema } from './onboarding';

/**
 * Contracts for the admin console sections beyond the directory.
 *
 * Split from admin.ts to keep that file about people and KYC; this one is
 * everything the console reports on rather than acts on.
 */

// --- company management ---

export const adminCompanyRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  registrationNumber: z.string().nullable(),
  tin: z.string().nullable(),
  tradeLicenseNo: z.string().nullable(),
  verified: z.boolean(),
  ownerName: z.string(),
  ownerPhone: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
});
export type AdminCompanyRow = z.infer<typeof adminCompanyRowSchema>;

export const adminCompanyListSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(adminCompanyRowSchema),
});
export type AdminCompanyList = z.infer<typeof adminCompanyListSchema>;

// --- analytics ---

export const adminAnalyticsSchema = z.object({
  /** Sign-ups per day for the last 14 days, oldest first. */
  signupsByDay: z.array(
    z.object({ date: z.string(), count: z.number().int().nonnegative() }),
  ),
  accountTypeSplit: z.object({
    individual: z.number().int().nonnegative(),
    company: z.number().int().nonnegative(),
    unset: z.number().int().nonnegative(),
  }),
  /** How far accounts get through verification — the drop-off is the point. */
  verificationFunnel: z.object({
    registered: z.number().int().nonnegative(),
    profileComplete: z.number().int().nonnegative(),
    documentsUploaded: z.number().int().nonnegative(),
    submitted: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
  }),
  emailAdoption: z.object({
    withEmail: z.number().int().nonnegative(),
    verified: z.number().int().nonnegative(),
  }),
});
export type AdminAnalytics = z.infer<typeof adminAnalyticsSchema>;

// --- AI monitoring / fraud ---

export const aiAlertSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userPhone: z.string(),
  kind: documentKindSchema,
  status: analysisStatusSchema,
  sharpness: z.number().nullable(),
  glare: z.number().nullable(),
  cardFound: z.boolean().nullable(),
  facesDetected: z.number().int().nullable(),
  faceMatch: z.number().nullable(),
  extractedNid: z.string().nullable(),
  extractedName: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type AiAlert = z.infer<typeof aiAlertSchema>;

export const aiMonitoringSchema = z.object({
  counts: z.object({
    passed: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
  }),
  alerts: z.array(aiAlertSchema),
});
export type AiMonitoring = z.infer<typeof aiMonitoringSchema>;

/** Heuristics over the same analyses, phrased as risk rather than image quality. */
export const fraudSignalSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userPhone: z.string(),
  /** Higher is worse. Derived, not stored — see AdminInsightsService. */
  riskScore: z.number().int(),
  reasons: z.array(z.string()),
});
export type FraudSignal = z.infer<typeof fraudSignalSchema>;

export const fraudReportSchema = z.object({
  flagged: z.number().int().nonnegative(),
  signals: z.array(fraudSignalSchema),
});
export type FraudReport = z.infer<typeof fraudReportSchema>;

// --- security ---

export const adminSessionRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userPhone: z.string(),
  deviceId: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type AdminSessionRow = z.infer<typeof adminSessionRowSchema>;

export const securityOverviewSchema = z.object({
  activeSessions: z.number().int().nonnegative(),
  suspendedAccounts: z.number().int().nonnegative(),
  adminAccounts: z.number().int().nonnegative(),
  admins: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      lastLoginAt: z.string().nullable(),
    }),
  ),
  recentSessions: z.array(adminSessionRowSchema),
});
export type SecurityOverview = z.infer<typeof securityOverviewSchema>;

// --- system management ---

export const systemStatusSchema = z.object({
  database: z.enum(['up', 'down']),
  uptimeSeconds: z.number().int().nonnegative(),
  nodeVersion: z.string(),
  environment: z.string(),
  smsProvider: z.string(),
  mailProvider: z.string(),
  /** True when codes are written to a file instead of delivered. */
  smsIsDevProvider: z.boolean(),
  counts: z.object({
    users: z.number().int().nonnegative(),
    documents: z.number().int().nonnegative(),
    tickets: z.number().int().nonnegative(),
    notifications: z.number().int().nonnegative(),
  }),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;

// --- notifications ---

export const notificationAudienceSchema = z.enum([
  'ALL',
  'WORKERS',
  'EMPLOYERS',
]);

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  audience: notificationAudienceSchema,
  createdAt: z.string(),
  sentAt: z.string().nullable(),
});
export type AdminNotification = z.infer<typeof notificationSchema>;

export const createNotificationSchema = z.object({
  title: z.string().trim().min(3, 'Give the notice a title').max(120),
  body: z.string().trim().min(5, 'Write the message').max(1000),
  audience: notificationAudienceSchema.default('ALL'),
});
export type CreateNotificationDto = z.output<typeof createNotificationSchema>;

// --- support ---

export const ticketStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);
export const ticketPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const supportTicketSchema = z.object({
  id: z.string(),
  subject: z.string(),
  message: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  response: z.string().nullable(),
  userName: z.string().nullable(),
  userPhone: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type SupportTicket = z.infer<typeof supportTicketSchema>;

export const supportListSchema = z.object({
  open: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  tickets: z.array(supportTicketSchema),
});
export type SupportList = z.infer<typeof supportListSchema>;

export const respondTicketSchema = z.object({
  response: z.string().trim().min(3, 'Write a reply').max(2000),
  status: ticketStatusSchema.default('RESOLVED'),
});
export type RespondTicketDto = z.output<typeof respondTicketSchema>;

// --- CMS ---

export const contentBlockSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  body: z.string(),
  locale: z.string(),
  updatedAt: z.string(),
});
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const upsertContentSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9.-]+$/, 'Use lowercase letters, digits, dots and dashes'),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(8000),
  locale: z.enum(['bn', 'en']).default('bn'),
});
export type UpsertContentDto = z.output<typeof upsertContentSchema>;

// --- attendance ---

export const attendanceStatusSchema = z.enum([
  'CHECKED_IN',
  'CHECKED_OUT',
  'ABSENT',
  'LATE',
]);

export const attendanceRowSchema = z.object({
  id: z.string(),
  userName: z.string(),
  userPhone: z.string(),
  status: attendanceStatusSchema,
  checkInAt: z.string(),
  checkOutAt: z.string().nullable(),
  note: z.string().nullable(),
});
export type AttendanceRow = z.infer<typeof attendanceRowSchema>;

export const attendanceListSchema = z.object({
  total: z.number().int().nonnegative(),
  today: z.number().int().nonnegative(),
  rows: z.array(attendanceRowSchema),
});
export type AttendanceList = z.infer<typeof attendanceListSchema>;

// --- reports ---

export const reportSummarySchema = z.object({
  generatedAt: z.string(),
  users: z.object({
    total: z.number().int().nonnegative(),
    workers: z.number().int().nonnegative(),
    employers: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
    newThisWeek: z.number().int().nonnegative(),
  }),
  verification: z.object({
    approved: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
  support: z.object({
    open: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
  }),
  /** Ready-to-copy CSV of the same figures, for pasting into a sheet. */
  csv: z.string(),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;

// --- settings ---

export const changeAdminPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72)
      .regex(/[a-z]/, 'Include a small letter')
      .regex(/[A-Z]/, 'Include a capital letter')
      .regex(/\d/, 'Include a digit')
      .regex(/[^A-Za-z0-9]/, 'Include a special character'),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
  });
export type ChangeAdminPasswordDto = z.output<typeof changeAdminPasswordSchema>;

export { accountTypeSchema };
