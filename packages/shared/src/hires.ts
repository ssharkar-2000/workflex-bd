import { z } from 'zod';
import { jobCategorySchema } from './job-categories';
import { jobTypeSchema, paymentTypeSchema, workplaceTypeSchema } from './jobs';
import { reviewRoleSchema } from './reviews';
import { hireUnavailableSchema, jobStaffingSchema } from './hire-replacement';

/**
 * Hires, grouped by job — the two lists that close the loop on a job.
 *
 * `as` is the reader's side of the hire. RECRUITER lists the people this
 * account hired who are still working; finishing a job takes someone off it.
 * WORKER lists the recruiters who hired this account, finished jobs included,
 * because the end of a job is exactly when a worker has something to say.
 */
export const hireListQuerySchema = z.object({ as: reviewRoleSchema.default('RECRUITER') });
export type HireListQuery = z.output<typeof hireListQuerySchema>;

/** The job both people share, as the lists show it. */
export const hireJobSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  companyName: z.string(),
  category: jobCategorySchema,
  jobType: jobTypeSchema,
  workplaceType: workplaceTypeSchema,
  location: z.string(),
  paymentType: paymentTypeSchema,
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  startDate: z.string().nullable(),
});
export type HireJob = z.infer<typeof hireJobSchema>;

/** The other person in one hire: a hired worker, or the recruiter who hired. */
export const hirePersonSchema = z.object({
  userId: z.string().uuid(),
  publicId: z.string(),
  name: z.string(),
  /** Hired people share numbers — the two of them have work to arrange. */
  phone: z.string(),
  hiredAt: z.string(),
  /** Set once the recruiter confirmed the work is finished. */
  completedAt: z.string().nullable(),
  /** Moved through the wallet between the two of them for this job. */
  paid: z.number().int(),
  /** What the reader already wrote about this person for this job. */
  myReview: z
    .object({ rating: z.number().int().min(1).max(5), comment: z.string().nullable() })
    .nullable(),
  /** Set while this hire cannot do the job and nobody has taken their place. */
  unavailable: hireUnavailableSchema.nullable().default(null),
  /** Set once somebody took this person's place; `completedAt` is set with it. */
  replacedAt: z.string().nullable().default(null),
  /** Who took this person's place. */
  replacedBy: z.object({ userId: z.string().uuid(), name: z.string() }).nullable().default(null),
  /** Whose place this person took. */
  replaces: z.object({ userId: z.string().uuid(), name: z.string() }).nullable().default(null),
});
export type HirePerson = z.infer<typeof hirePersonSchema>;

export const hireGroupSchema = z.object({
  job: hireJobSchema,
  /** How full the job is, from the poster's side: see staffingOf. */
  staffing: jobStaffingSchema.default('RECRUITING'),
  people: z.array(hirePersonSchema),
});
export type HireGroup = z.infer<typeof hireGroupSchema>;

export const hireListSchema = z.object({
  as: reviewRoleSchema,
  groups: z.array(hireGroupSchema),
});
export type HireList = z.infer<typeof hireListSchema>;

export const hireCompletedSchema = z.object({
  jobId: z.string().uuid(),
  workerId: z.string().uuid(),
  completedAt: z.string(),
});
export type HireCompleted = z.infer<typeof hireCompletedSchema>;
