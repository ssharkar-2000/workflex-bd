import { z } from 'zod';

/**
 * Reports: "something here is wrong".
 *
 * Deliberately separate from support tickets, which are "I need help". The
 * two look similar as forms and behave nothing alike afterwards — a support
 * ticket ends when someone answers it, while a report may end in a suspended
 * account, a removed posting, or nothing at all, and the reporter is not
 * always entitled to know which. Merging them would put both workflows behind
 * one queue and one status vocabulary that fits neither.
 */

/**
 * What went wrong. Chosen so an admin can route the queue at a glance: fraud
 * and non-payment need acting on today, a technical complaint does not.
 */
export const reportCategorySchema = z.enum([
  'FRAUD',
  'FAKE_JOB',
  'MISLEADING_PAY',
  'NON_PAYMENT',
  'HARASSMENT',
  'UNSAFE_WORK',
  'FAKE_PROFILE',
  'TECHNICAL',
  'OTHER',
]);
export type ReportCategory = z.infer<typeof reportCategorySchema>;

/** What the report is about, which decides what the admin can act on. */
export const reportTargetSchema = z.enum([
  'SYSTEM',
  'JOB',
  'PERSON',
  'OTHER',
]);
export type ReportTarget = z.infer<typeof reportTargetSchema>;

/**
 * `ACTION_TAKEN` and `DISMISSED` are both endings, kept apart because they
 * mean opposite things to the reporter and to anyone auditing the queue
 * later. A single "closed" would erase that.
 */
export const reportStatusSchema = z.enum([
  'OPEN',
  'IN_REVIEW',
  'ACTION_TAKEN',
  'DISMISSED',
]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const createReportSchema = z
  .object({
    category: reportCategorySchema,
    targetType: reportTargetSchema.default('OTHER'),
    /** The posting complained about, when the report is about one. */
    targetJobId: z.string().uuid().optional(),
    /**
     * The person complained about, as the reporter knows them — a phone
     * number, not an account id. Someone reporting an employer who cheated
     * them has a number from a job advert, not a database key.
     */
    targetPhone: z.string().trim().max(20).optional(),
    subject: z.string().trim().min(5, 'Give it a short subject').max(140),
    details: z.string().trim().min(20, 'Describe what happened').max(4000),
  })
  .superRefine((v, ctx) => {
    // A report about a posting that names no posting cannot be investigated.
    if (v.targetType === 'JOB' && !v.targetJobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetJobId'],
        message: 'Choose which job this is about',
      });
    }
    if (v.targetType === 'PERSON' && !v.targetPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetPhone'],
        message: 'Give the phone number of the person you are reporting',
      });
    }
  });
export type CreateReportDto = z.output<typeof createReportSchema>;

/** What the reporter sees of their own report. */
export const myReportSchema = z.object({
  id: z.string(),
  category: reportCategorySchema,
  targetType: reportTargetSchema,
  targetJobTitle: z.string().nullable(),
  subject: z.string(),
  details: z.string(),
  status: reportStatusSchema,
  /** Null until an admin writes back. Not every report gets a reply. */
  response: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type MyReport = z.infer<typeof myReportSchema>;

export const myReportListSchema = z.object({
  reports: z.array(myReportSchema),
});
export type MyReportList = z.infer<typeof myReportListSchema>;

// --- admin ---

export const adminReportSchema = myReportSchema.extend({
  reporterName: z.string().nullable(),
  reporterPhone: z.string(),
  targetPhone: z.string().nullable(),
  targetJobId: z.string().nullable(),
});
export type AdminReport = z.infer<typeof adminReportSchema>;

export const adminReportListSchema = z.object({
  /** Awaiting a first look — the number the console badges. */
  open: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Per category, so the queue can be triaged before anything is opened. */
  byCategory: z.record(reportCategorySchema, z.number().int()),
  reports: z.array(adminReportSchema),
});
export type AdminReportList = z.infer<typeof adminReportListSchema>;

export const resolveReportSchema = z.object({
  status: reportStatusSchema,
  /**
   * Optional: an admin may move a report to IN_REVIEW without writing
   * anything, and some outcomes cannot be shared with the reporter at all.
   */
  response: z.string().trim().max(2000).optional(),
});
export type ResolveReportDto = z.output<typeof resolveReportSchema>;
