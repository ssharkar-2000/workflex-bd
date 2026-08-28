import { z } from 'zod';
import { jobCategorySchema } from './job-categories';

/**
 * Job listings, from the seeker's side.
 *
 * The filters mirror what someone scanning for shift work actually decides
 * between — how the hours are shaped (`jobType`), whether they have to travel
 * (`workplaceType`), and what the job is (`category`). Salary is a free-text
 * range rather than a number: postings in this market quote "৳15,000–20,000",
 * "negotiable", or a daily rate, and forcing that into an integer would make
 * most listings unpostable.
 */

export const jobTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'TEMPORARY',
  'INTERNSHIP',
  'ONE_TIME',
]);
export type JobType = z.infer<typeof jobTypeSchema>;

export const workplaceTypeSchema = z.enum(['ONSITE', 'REMOTE', 'HYBRID']);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

export const experienceLevelSchema = z.enum([
  'ENTRY',
  'ONE_TO_THREE',
  'THREE_TO_FIVE',
  'FIVE_PLUS',
]);
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;

export const jobListingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  companyName: z.string(),
  /** Short label shown on the card's logo tile when there is no image. */
  companyInitials: z.string(),
  category: jobCategorySchema,
  jobType: jobTypeSchema,
  workplaceType: workplaceTypeSchema,
  experienceLevel: experienceLevelSchema,
  location: z.string(),
  salaryRange: z.string().nullable(),
  description: z.string(),
  /** Null when the posting has no closing date. */
  deadline: z.string().nullable(),
  /** Whole days remaining; negative is impossible — expired jobs are filtered out. */
  daysLeft: z.number().int().nullable(),
  postedAt: z.string(),
  /** Whether the signed-in account has bookmarked this listing. */
  saved: z.boolean(),
});
export type JobListing = z.infer<typeof jobListingSchema>;

export const jobListSchema = z.object({
  items: z.array(jobListingSchema),
  /** Matching the filters, not the page — this is the "N available jobs" count. */
  total: z.number().int().nonnegative(),
  /** Cursor for the next page; null when the last page has been served. */
  nextCursor: z.string().nullable(),
});
export type JobList = z.infer<typeof jobListSchema>;

/**
 * Query for the listing screen. Every field optional — an empty query is the
 * default "everything on offer" view the screen opens with.
 */
export const jobQuerySchema = z.object({
  /** Matched against title, company and location. */
  q: z.string().trim().max(120).optional(),
  category: jobCategorySchema.optional(),
  jobType: jobTypeSchema.optional(),
  workplaceType: workplaceTypeSchema.optional(),
  /** Only listings the account has bookmarked. */
  savedOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type JobQuery = z.output<typeof jobQuerySchema>;
