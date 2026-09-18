import { z } from 'zod';
import { jobCategorySchema } from './job-categories';
import { divisionSchema } from './bd-geography';
import { jobMatchSchema } from './matching';

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
  /**
   * Whether this account has an open application. Withdrawing sets it back to
   * false, so the button always reflects what pressing it will do.
   */
  applied: z.boolean(),
  /**
   * True on a posting this account created. Applying to your own job is
   * refused server-side; the screen uses this to not offer the button at all.
   */
  isMine: z.boolean(),

  /**
   * Null when the account has no parsed CV, or when CV parsing is switched
   * off on the server. Deliberately not zero — "no score" and "scored zero"
   * are different things, and conflating them would tell someone they are a
   * poor fit for work they never asked to be measured against.
   */
  match: jobMatchSchema.nullable(),
});
export type JobListing = z.infer<typeof jobListingSchema>;

/**
 * The discovery strip at the top of the job feed.
 *
 * Counted over open listings only — a total that included expired postings
 * would flatter the number and mislead someone deciding whether the app is
 * worth using.
 */
export const jobStatsSchema = z.object({
  activeJobs: z.number().int().nonnegative(),
  /** Summed across postings that state a figure; the rest count as one each. */
  vacancies: z.number().int().nonnegative(),
  /** Distinct employers currently hiring. */
  organizations: z.number().int().nonnegative(),
});
export type JobStats = z.infer<typeof jobStatsSchema>;

export const jobHighlightsSchema = z.object({
  stats: jobStatsSchema,
  /** Ranked by how soon someone is needed, not by a fabricated match score. */
  jobs: z.array(jobListingSchema),
});
export type JobHighlights = z.infer<typeof jobHighlightsSchema>;

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

// --- posting ---

/**
 * Who the job is being posted on behalf of.
 *
 * Anyone may post as themselves — needing help at home should not require a
 * business. Posting as a company requires an approved trade licence, which is
 * what verification level 2 records.
 */
export const postAsSchema = z.enum(['INDIVIDUAL', 'COMPANY']);
export type PostAs = z.infer<typeof postAsSchema>;

/**
 * What both forms ask.
 *
 * Everything here is something the person hiring genuinely knows: what the
 * work is, where, when, and what it pays. The company form adds what a
 * business posting needs on top.
 */
const jobPostBase = {
  title: z.string().trim().min(4, 'Give the job a title').max(120),
  category: jobCategorySchema,
  description: z
    .string()
    .trim()
    .min(20, 'Describe the work in a little more detail')
    .max(4000),

  location: z.string().trim().min(3, 'Where is the work?').max(120),
  division: divisionSchema,
  district: z.string().trim().min(1).max(60),

  jobType: jobTypeSchema,
  duration: jobDurationSchema,
  workingTime: workingTimeSchema.default('FLEXIBLE'),
  hoursBand: hoursBandSchema.optional(),

  paymentType: paymentTypeSchema,
  salaryMin: z.number().int().min(0).max(10_000_000).optional(),
  salaryMax: z.number().int().min(0).max(10_000_000).optional(),

  urgency: urgencySchema.default('NONE'),
  /** ISO date. Omitted means the employer is flexible about the start. */
  startDate: z.string().datetime().optional(),
  vacancies: z.number().int().min(1).max(999).optional(),
};

/**
 * A pay range that runs backwards is a typo, not a preference, and it would
 * silently match nothing in the seeker's filter. Checked on both branches.
 */
function checkPayOrder(
  value: { salaryMin?: number; salaryMax?: number },
  ctx: z.RefinementCtx,
) {
  if (
    value.salaryMin !== undefined &&
    value.salaryMax !== undefined &&
    value.salaryMin > value.salaryMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['salaryMax'],
      message: 'Maximum pay cannot be less than the minimum',
    });
  }
}

export const createJobSchema = z
  .discriminatedUnion('postAs', [
    z.object({
      postAs: z.literal('INDIVIDUAL'),
      ...jobPostBase,
    }),
    z.object({
      postAs: z.literal('COMPANY'),
      ...jobPostBase,

      /**
       * Asked here rather than at registration. Most people never post a
       * company job, and making everyone name a business at signup forced a
       * choice at the front door that the product no longer needs.
       */
      companyName: z.string().trim().min(2, 'Enter the company name').max(120),
      companyRegistrationNumber: z
        .string()
        .trim()
        .min(3, 'Enter the registration number')
        .max(60),
      /** The poster's role there — reviewers use it to sanity-check authority. */
      designation: z.string().trim().min(2, 'Enter your job title').max(80),

      /** A business posting is expected to say what it wants and what it offers. */
      experienceLevel: experienceLevelSchema,
      workplaceType: workplaceTypeSchema,
      requirements: z.string().trim().max(4000).optional(),
      benefits: z.string().trim().max(4000).optional(),
      /** Days from now until applications close. */
      openForDays: z.number().int().min(1).max(180).default(30),
    }),
  ])
  .superRefine(checkPayOrder);
export type CreateJobDto = z.output<typeof createJobSchema>;
export type CreateJobInput = z.input<typeof createJobSchema>;

/** A posting as its author sees it, with the count of people who saw it. */
export const myJobSchema = jobListingSchema.extend({
  isOpen: z.boolean(),
  savedByCount: z.number().int().nonnegative(),
  /**
   * People who applied and have not withdrawn. This is how a poster finds out
   * anyone applied at all — notifications here are admin broadcasts to an
   * audience, so there is no per-user event to send.
   */
  applicantCount: z.number().int().nonnegative(),
  /**
   * How far through that pile the poster has got.
   *
   * Kept beside the applicant count rather than derived from it, because the
   * pair is the whole story on a hiring card: ten applicants and none
   * shortlisted is a posting that needs an hour of someone's attention, while
   * ten and six is one that is nearly decided.
   */
  shortlistedCount: z.number().int().nonnegative(),
});
export type MyJob = z.infer<typeof myJobSchema>;

export const myJobListSchema = z.object({ jobs: z.array(myJobSchema) });
export type MyJobList = z.infer<typeof myJobListSchema>;

/**
 * Work this account has been accepted for and has not yet done.
 *
 * The full listing rather than a trimmed shape, because "upcoming work" is
 * still a posting — the same title, place and pay the person agreed to — and
 * a second, thinner copy of a job would drift from this one the first time a
 * field was added.
 *
 * Two things the design for this asked for do not exist in the data and are
 * absent rather than invented. There is no start and finish *time*: a posting
 * carries `workingTime` (morning, evening) and `hoursBand` (4–6 hours), which
 * is what employers in this market actually write down, and no clock times to
 * print as "5:00 PM – 7:00 PM". And there are no coordinates on a job, only
 * the free-text place the recruiter typed, so nothing here can drop a pin.
 *
 * Accepted applications are the source. An application that is merely
 * shortlisted is not work anyone should be told to turn up for.
 */
export const upcomingWorkSchema = z.object({
  jobs: z.array(jobListingSchema),
});
export type UpcomingWork = z.infer<typeof upcomingWorkSchema>;

/**
 * Open work in the area this account gave as its address.
 *
 * Deliberately an *area*, not a radius. Nothing in this product stores a
 * coordinate for a job or for a person — a posting carries the free text a
 * recruiter typed ("Mirpur 10, Dhaka") and an account carries the address
 * someone wrote at registration. There is no arithmetic that turns two pieces
 * of prose into "1.2 km", and a distance invented from a district centroid
 * would be wrong by kilometres in exactly the dense neighbourhoods where
 * people care about the difference.
 *
 * So the unit here is the name of the place, which is how work near home is
 * actually described in Bangladesh: someone in Dhanmondi looks for jobs in
 * Dhanmondi, not jobs within 4.7km. Giving distances would need coordinates
 * on every posting, a geocoder to produce them, and the device's own position
 * — see the note in the mobile component.
 */
/**
 * Query for GET /jobs/nearby.
 *
 * Coordinates arrive as strings on a query string, so they are coerced and
 * then bounded: a latitude of 200 is not a typo to be clamped, it is a
 * malformed request, and rejecting it beats measuring distances from a point
 * that cannot exist.
 */
export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  /** Capped so one request cannot ask the server to rank the whole country. */
  radiusKm: z.coerce.number().positive().max(200).optional(),
});
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

/** One posting with how far away it is. */
export const nearbyJobSchema = z.object({
  job: jobListingSchema,
  /**
   * Kilometres, straight line, to one decimal.
   *
   * Approximate by construction and shown with a "~" everywhere: a posting's
   * point is the centre of its named place, so this is accurate to roughly
   * that place's size. One decimal is already generous — a second would imply
   * a precision the inputs do not have.
   */
  distanceKm: z.number().nonnegative(),
});
export type NearbyJob = z.infer<typeof nearbyJobSchema>;

/** How the viewer's own position was arrived at. */
export const originKindSchema = z.enum([
  /** The device's GPS, with the person's permission. */
  'DEVICE',
  /** The centre of the area named in their registered address. */
  'ADDRESS',
]);
export type OriginKind = z.infer<typeof originKindSchema>;

export const nearbyJobsSchema = z.object({
  /**
   * Where distances were measured from, and how that point was obtained.
   *
   * Null when neither is available — no device position offered and an address
   * naming nowhere the gazetteer knows — which is the app's signal to say so
   * rather than show a list under a heading that promises proximity.
   */
  origin: z
    .object({
      kind: originKindSchema,
      /** The place name, for "12 jobs within 5 km of Dhanmondi". */
      area: z.string().nullable(),
    })
    .nullable(),
  /** The radius the count was taken over, in kilometres. */
  radiusKm: z.number().positive(),
  /** Open postings inside that radius, which may exceed the ones listed. */
  total: z.number().int().nonnegative(),
  jobs: z.array(nearbyJobSchema),
});
export type NearbyJobs = z.infer<typeof nearbyJobsSchema>;
