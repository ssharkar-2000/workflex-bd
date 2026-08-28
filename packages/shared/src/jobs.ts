import { z } from 'zod';
import { jobCategorySchema } from './job-categories';
import { divisionSchema } from './bd-geography';

/**
 * Job listings and the filters over them.
 *
 * The filter set is deliberately wider than a conventional job board's,
 * because this marketplace carries "a cleaner for three hours this afternoon"
 * alongside "a permanent software engineer". Duration, working time, start
 * date and urgency are what separate those two, and a board that only filters
 * by employment type and salary cannot tell them apart.
 *
 * Every axis is independent and every one is multi-select: someone is
 * plausibly open to a morning *or* evening shift, part-time *or* one-off. A
 * single-choice filter would make them run the search several times.
 */

// --- employment shape ---

/**
 * How the engagement is structured. Payment cadence lives in `PaymentType`
 * and time-of-day in `WorkingTime` — mixing "Hourly" in here would make a
 * posting that is both Part-Time and Hourly pick one and lose the other.
 */
export const jobTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'PERMANENT',
  'CONTRACT',
  'FREELANCE',
  'INTERNSHIP',
  'TEMPORARY',
  'SEASONAL',
  'SHIFT_BASED',
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

// --- money ---

export const paymentTypeSchema = z.enum([
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'FIXED_PROJECT',
  'NEGOTIABLE',
]);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

// --- time ---

export const workingTimeSchema = z.enum([
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'NIGHT',
  'FLEXIBLE',
]);
export type WorkingTime = z.infer<typeof workingTimeSchema>;

/** Hours per day, as bands — postings quote a range, not an exact figure. */
export const hoursBandSchema = z.enum(['H2_3', 'H4_6', 'H6_8', 'H8_PLUS']);
export type HoursBand = z.infer<typeof hoursBandSchema>;

export const jobDurationSchema = z.enum([
  'ONE_TIME',
  'ONE_DAY',
  'FEW_DAYS',
  'ONE_WEEK',
  'ONE_MONTH',
  'THREE_TO_SIX_MONTHS',
  'LONG_TERM',
]);
export type JobDuration = z.infer<typeof jobDurationSchema>;

/**
 * How soon the employer needs someone. The distinguishing feature of this
 * marketplace against a conventional board, and the reason a listing can
 * carry a 🔥 badge.
 */
export const urgencySchema = z.enum([
  'IMMEDIATE',
  'WITHIN_24H',
  'WITHIN_3_DAYS',
  'THIS_WEEK',
  'NONE',
]);
export type Urgency = z.infer<typeof urgencySchema>;

/** Relative windows the start-date filter offers, resolved server-side. */
export const startWindowSchema = z.enum([
  'TODAY',
  'TOMORROW',
  'THIS_WEEK',
  'THIS_MONTH',
  'FLEXIBLE',
]);
export type StartWindow = z.infer<typeof startWindowSchema>;

// --- listing ---

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

  division: divisionSchema.nullable(),
  district: z.string().nullable(),
  /** Free text as the recruiter typed it — "Mirpur 10, Dhaka". */
  location: z.string(),

  paymentType: paymentTypeSchema,
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),

  workingTime: workingTimeSchema,
  hoursBand: hoursBandSchema.nullable(),
  duration: jobDurationSchema,
  urgency: urgencySchema,

  /** Null when the employer is flexible about when the work starts. */
  startDate: z.string().nullable(),
  flexibleStart: z.boolean(),

  description: z.string(),
  /** Free text; null on postings that only carry a description. */
  requirements: z.string().nullable(),
  benefits: z.string().nullable(),
  /** Null means the employer did not say, which the screen states plainly. */
  vacancies: z.number().int().nullable(),
  deadline: z.string().nullable(),
  /** Whole days remaining; expired listings are filtered out, never negative. */
  daysLeft: z.number().int().nullable(),
  postedAt: z.string(),
  saved: z.boolean(),
});
export type JobListing = z.infer<typeof jobListingSchema>;

export const jobListSchema = z.object({
  items: z.array(jobListingSchema),
  /** Matching the filters, not the page — this is the "N available jobs" count. */
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});
export type JobList = z.infer<typeof jobListSchema>;

// --- query ---

/**
 * Accepts `?jobTypes=FULL_TIME,PART_TIME` as well as a repeated parameter.
 *
 * Multi-select filters have to survive a URL, and the two conventions for
 * that disagree: axios serialises an array as repeated keys, while a
 * hand-written link uses commas. Normalising both here means the client can
 * use whichever without the server caring.
 */
function multi<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parts = Array.isArray(value) ? value : String(value).split(',');
    const cleaned = parts.map((p) => String(p).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }, z.array(inner).optional());
}

export const jobQuerySchema = z.object({
  /** Matched against title, company, location and district. */
  q: z.string().trim().max(120).optional(),

  categories: multi(jobCategorySchema),
  jobTypes: multi(jobTypeSchema),
  workplaceTypes: multi(workplaceTypeSchema),
  experienceLevels: multi(experienceLevelSchema),
  paymentTypes: multi(paymentTypeSchema),
  workingTimes: multi(workingTimeSchema),
  hoursBands: multi(hoursBandSchema),
  durations: multi(jobDurationSchema),
  urgencies: multi(urgencySchema),
  divisions: multi(divisionSchema),
  districts: multi(z.string().min(1).max(60)),

  /**
   * Overlap, not containment: a posting paying ৳15,000–25,000 matches a
   * seeker asking for at least ৳20,000, because part of the offered range
   * clears their floor. Requiring the whole range to sit inside the filter
   * would hide most listings.
   */
  salaryMin: z.coerce.number().int().min(0).max(10_000_000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(10_000_000).optional(),

  startWindow: startWindowSchema.optional(),

  savedOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type JobQuery = z.output<typeof jobQuerySchema>;

/** Fields the filter sheet owns — everything except paging. */
export type JobFilterState = Omit<JobQuery, 'cursor' | 'limit'>;
