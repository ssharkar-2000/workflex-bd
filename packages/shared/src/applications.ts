import { z } from 'zod';
import { jobCategorySchema } from './job-categories';
import { paymentTypeSchema } from './jobs';

/**
 * Applying to a posting.
 *
 * The whole flow is deliberately one tap. This market's users are applying on
 * a phone, often on mobile data, frequently for shift work that will be gone
 * by tomorrow — a multi-step form with a cover letter would lose most of them
 * before they finished. The CV and verified profile already carry everything
 * an employer needs; the optional note below is for the one line that does not
 * fit either ("I can start Sunday").
 */

/** Mirrors the Prisma enum of the same name. */
export const applicationStatusSchema = z.enum([
  'SUBMITTED',
  'VIEWED',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

/**
 * Statuses that still count as "in play" for the applicant.
 *
 * Used for the badge on the applications list and for the applicant count a
 * poster sees, so both agree on what an open application is.
 */
export const ACTIVE_APPLICATION_STATUSES = [
  'SUBMITTED',
  'VIEWED',
  'SHORTLISTED',
  'ACCEPTED',
] as const satisfies readonly ApplicationStatus[];

export function isActiveApplication(status: ApplicationStatus): boolean {
  return (ACTIVE_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(
    status,
  );
}

export const applyToJobSchema = z.object({
  /**
   * Optional and short. Capped well below what a cover letter would need,
   * because this is a note and framing it as one keeps it from becoming a
   * barrier.
   */
  message: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ApplyToJobDto = z.output<typeof applyToJobSchema>;
export type ApplyToJobInput = z.input<typeof applyToJobSchema>;

/** One row on the applicant's own list. */
export const jobApplicationSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string(),
  companyName: z.string(),
  companyInitials: z.string(),
  category: jobCategorySchema,
  location: z.string(),
  /**
   * Raw pay fields rather than a formatted string: every other surface
   * formats these client-side, and a server-formatted label here would drift
   * from the job cards the moment either changed.
   */
  paymentType: paymentTypeSchema,
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  status: applicationStatusSchema,
  message: z.string().nullable(),
  appliedAt: z.string(),
  /**
   * False once the posting is closed or its deadline passes. The application
   * stays on the list either way — disappearing would read as "lost", and the
   * applicant is entitled to know they applied.
   */
  jobIsOpen: z.boolean(),
});
export type JobApplication = z.infer<typeof jobApplicationSchema>;

export const jobApplicationListSchema = z.object({
  applications: z.array(jobApplicationSchema),
});
export type JobApplicationList = z.infer<typeof jobApplicationListSchema>;

/** What `POST /jobs/:id/apply` and its withdraw counterpart return. */
export const applicationStateSchema = z.object({
  applied: z.boolean(),
  status: applicationStatusSchema.nullable(),
});
export type ApplicationState = z.infer<typeof applicationStateSchema>;

// --- the poster's side ---

/** One person who applied, as the poster sees them. */
export const applicantSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  /** Identity verified. Applying requires it, so this is false only on old rows. */
  verified: z.boolean(),
  status: applicationStatusSchema,
  message: z.string().nullable(),
  appliedAt: z.string(),
  /**
   * Only once hired. Before that the poster is choosing between strangers
   * and has no need of their numbers; after it, the two of them have work to
   * arrange.
   */
  phone: z.string().nullable(),
  /** Paid through the wallet for this job so far. */
  paidSoFar: z.number().int(),
});
export type Applicant = z.infer<typeof applicantSchema>;

export const applicantListSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string(),
  isOpen: z.boolean(),
  applicants: z.array(applicantSchema),
});
export type ApplicantList = z.infer<typeof applicantListSchema>;

/**
 * The poster's decision on one application.
 *
 * ACCEPTED is hiring — it is what puts the work on the person's schedule and
 * what lets the poster pay them through the wallet.
 */
export const decideApplicationSchema = z.object({
  status: z.enum(['SHORTLISTED', 'ACCEPTED', 'REJECTED']),
});
export type DecideApplicationDto = z.output<typeof decideApplicationSchema>;
