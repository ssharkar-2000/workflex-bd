import { z } from 'zod';
import { reviewRoleSchema } from './reviews';

/**
 * Replacing a hired worker who can no longer do the job.
 *
 *     shortlisted -> hired -> unavailable -> Replacement Matcher
 *                 -> eligible shortlisted candidates -> Assign as Replacement
 *                 -> the new person is hired, the old hire is closed
 *
 * "Unavailable" is a flag on the hire, set by the worker ("I can't continue")
 * or by the employer. It is not a status of its own: the person is still an
 * accepted hire, so what they were paid and how they were rated keep counting.
 * The flag is what puts them in the employer's Replacement Matcher.
 *
 * Who may stand in is decided by the server, not by the screen: only people
 * the employer already shortlisted for this job, who are free for the shifts
 * they would take over and whose CV does not plainly fail what the posting
 * asks for. The list shows who was left out and why, so an employer is never
 * left wondering where somebody went.
 */

/** Why a hired worker cannot do the job any more. */
export const hireUnavailableReasonSchema = z.enum(['DROPPED_OUT', 'SICK', 'NO_SHOW', 'OTHER']);
export type HireUnavailableReason = z.infer<typeof hireUnavailableReasonSchema>;

export const markUnavailableSchema = z.object({
  reason: hireUnavailableReasonSchema,
  /** Anything else worth saying. Optional: "sick" says it. */
  note: z.string().trim().max(300).optional(),
});
export type MarkUnavailableDto = z.output<typeof markUnavailableSchema>;
export type MarkUnavailableInput = z.input<typeof markUnavailableSchema>;

/** A hire that has been flagged, as either side sees it. */
export const hireUnavailableSchema = z.object({
  at: z.string(),
  reason: hireUnavailableReasonSchema,
  note: z.string().nullable(),
  /** Which side reported it: the worker themselves, or the recruiter. */
  by: reviewRoleSchema,
});
export type HireUnavailable = z.infer<typeof hireUnavailableSchema>;

/**
 * Where a job stands on people, from its poster's side.
 *
 * Worked out from the hires each time, never stored: a stored status would
 * have to be kept right by every path that hires, completes or replaces
 * somebody, and would drift the first time one forgot.
 */
export const jobStaffingSchema = z.enum([
  /** Nobody is working it yet. */
  'RECRUITING',
  /** Some of the vacancies are filled. */
  'PARTLY_FILLED',
  /** Everybody the job asked for is hired and available. */
  'FILLED',
  /** A hired worker has dropped out and nobody has taken their place. */
  'NEEDS_REPLACEMENT',
]);
export type JobStaffing = z.infer<typeof jobStaffingSchema>;

/**
 * `working` is the hires still on the job and available; `unavailable` the
 * ones flagged and not yet replaced. A posting with no stated number of
 * vacancies is treated as wanting the people it has hired: naming one that was
 * never given would show every such job as forever half full.
 */
export function staffingOf(input: {
  vacancies: number | null;
  working: number;
  unavailable: number;
}): JobStaffing {
  if (input.unavailable > 0) return 'NEEDS_REPLACEMENT';
  if (input.working === 0) return 'RECRUITING';
  const wanted = input.vacancies ?? input.working;
  return input.working < wanted ? 'PARTLY_FILLED' : 'FILLED';
}

/** What a mark or an un-mark changed. */
export const availabilityChangedSchema = z.object({
  jobId: z.string().uuid(),
  workerId: z.string().uuid(),
  /** Null once the worker is available again. */
  unavailable: hireUnavailableSchema.nullable(),
  staffing: jobStaffingSchema,
});
export type AvailabilityChanged = z.infer<typeof availabilityChangedSchema>;

// --- the list of who could stand in ---

/** What could not be checked about somebody, so the employer knows what is on trust. */
export const candidateFlagSchema = z.enum(['NO_CV', 'YEARS_UNSTATED']);
export type CandidateFlag = z.infer<typeof candidateFlagSchema>;

export const hireCandidateSchema = z.object({
  userId: z.string().uuid(),
  publicId: z.string(),
  name: z.string(),
  verified: z.boolean(),
  /** 0–100: how well the CV fits the posting, on skills and experience. */
  fit: z.number().int().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  yearsExperience: z.number().nullable(),
  titles: z.array(z.string()),
  hasCv: z.boolean(),
  flags: z.array(candidateFlagSchema),
  /** When they applied. */
  appliedAt: z.string(),
});
export type HireCandidate = z.infer<typeof hireCandidateSchema>;

/** Why a shortlisted person is not offered. */
export const excludedReasonSchema = z.enum([
  /** They have a live shift at a time they would have to work. */
  'BUSY',
  /** Their CV plainly fails what the posting asks for. */
  'REQUIREMENTS',
  /** They blocked this employer. */
  'BLOCKED',
  /** Their account is suspended or closed. */
  'INACTIVE',
]);
export type ExcludedReason = z.infer<typeof excludedReasonSchema>;

export const excludedCandidateSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  reason: excludedReasonSchema,
  /** BUSY: when the clashing shift starts. */
  clashAt: z.string().nullable(),
  /** REQUIREMENTS: the years the posting asks for, and what the CV says. */
  needsYears: z.number().int().nullable(),
  hasYears: z.number().nullable(),
  /** REQUIREMENTS: nothing in the CV lines up with what the posting lists. */
  noSkillMatch: z.boolean(),
});
export type ExcludedCandidate = z.infer<typeof excludedCandidateSchema>;

export const replacementOptionsSchema = z.object({
  job: z.object({
    id: z.string().uuid(),
    title: z.string(),
    location: z.string(),
    vacancies: z.number().int().nullable(),
  }),
  /** The worker being replaced. */
  unavailable: z.object({
    userId: z.string().uuid(),
    publicId: z.string(),
    name: z.string(),
    phone: z.string(),
    reason: hireUnavailableReasonSchema,
    note: z.string().nullable(),
    by: reviewRoleSchema,
    at: z.string(),
  }),
  /** Their shifts still to come on this job: these pass to whoever is chosen. */
  shifts: z.array(
    z.object({
      id: z.string().uuid(),
      startsAt: z.string(),
      endsAt: z.string(),
      location: z.string().nullable(),
    }),
  ),
  /** Best fit first. */
  eligible: z.array(hireCandidateSchema),
  excluded: z.array(excludedCandidateSchema),
  /** Everyone on the shortlist, eligible or not. */
  shortlisted: z.number().int().nonnegative(),
});
export type ReplacementOptions = z.infer<typeof replacementOptionsSchema>;

// --- choosing one ---

export const assignReplacementSchema = z.object({ replacementId: z.string().uuid() });
export type AssignReplacementDto = z.output<typeof assignReplacementSchema>;

export const replacementAssignedSchema = z.object({
  jobId: z.string().uuid(),
  replaced: z.object({ userId: z.string().uuid(), name: z.string() }),
  replacement: z.object({ userId: z.string().uuid(), name: z.string(), phone: z.string() }),
  /** How many of the old worker's coming shifts now belong to the replacement. */
  movedShifts: z.number().int().nonnegative(),
  staffing: jobStaffingSchema,
});
export type ReplacementAssigned = z.infer<typeof replacementAssignedSchema>;
