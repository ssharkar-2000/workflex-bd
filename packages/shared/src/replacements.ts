import { z } from 'zod';

/**
 * Cover for a shift somebody has called off.
 *
 * The problem this solves is specific to temporary work: a cancellation at
 * nine at night for a six-in-the-morning shift leaves an employer ringing
 * round, and leaves the work undone. The matcher does the ringing round.
 *
 * The ranking is arithmetic, not a model call — the same judgement as
 * MatchService, and for stronger reasons here. An employer replacing someone
 * at short notice has to be able to see *why* a name is at the top, and a
 * score that cannot be explained is one they will not act on. What the model
 * does is write the line of reasoning and the message; what decides the order
 * is skills, a clear diary and a work record.
 */

/** One shift that needs somebody, because the person on it pulled out. */
export const coverGapSchema = z.object({
  shiftId: z.string().uuid(),
  jobId: z.string().uuid(),
  jobTitle: z.string(),
  /** Who cancelled. Named because the employer knows them already. */
  workerName: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  /** Paisa, as everywhere else. */
  pay: z.number().int(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  /**
   * Hours between now and the start. Negative once it has begun. This is what
   * orders the list — a gap tomorrow morning is not a gap next month.
   */
  hoursUntil: z.number(),
  /** True once a replacement shift has been confirmed for the same slot. */
  covered: z.boolean(),
});
export type CoverGap = z.infer<typeof coverGapSchema>;

/** What the record says about somebody turning up when they said they would. */
export const reliabilitySchema = z.object({
  completed: z.number().int().nonnegative(),
  noShows: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  /** 1–5, or null when nobody has reviewed them yet. */
  rating: z.number().nullable(),
});
export type Reliability = z.infer<typeof reliabilitySchema>;

export const replacementCandidateSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  /** Their own area, as they wrote it. Empty when they have not said. */
  area: z.string(),
  /** 0–100, the three axes below combined. */
  score: z.number().int().min(0).max(100),
  /** Each axis on its own, so the order can be argued with. */
  skillScore: z.number().int(),
  reliabilityScore: z.number().int(),
  nearbyScore: z.number().int(),
  matchedSkills: z.array(z.string()),
  reliability: reliabilitySchema,
  /** How they are already connected to this job or employer. */
  relation: z.enum(['APPLIED', 'SHORTLISTED', 'WORKED_BEFORE']),
  /** One line saying why they are on the list. */
  why: z.string(),
  /** True once this gap's message has gone to them. */
  asked: z.boolean(),
});
export type ReplacementCandidate = z.infer<typeof replacementCandidateSchema>;

export const replacementListSchema = z.object({
  gap: coverGapSchema,
  candidates: z.array(replacementCandidateSchema),
  /**
   * The draft the employer sends. Editable — it is their message, and the
   * worker will read it as having come from them.
   */
  draftMessage: z.string(),
  /** Whether the lines were written by the model or assembled from the record. */
  source: z.enum(['written', 'assembled']),
  /**
   * How many people were considered and dropped for a clashing shift. Shown
   * because "only two candidates" and "only two free" are different problems.
   */
  busyCount: z.number().int().nonnegative(),
});
export type ReplacementList = z.infer<typeof replacementListSchema>;

export const coverGapsSchema = z.object({ gaps: z.array(coverGapSchema) });
export type CoverGaps = z.infer<typeof coverGapsSchema>;

export const notifyReplacementsSchema = z.object({
  workerIds: z.array(z.string().uuid()).min(1).max(10),
  /** The message as the employer edited it. */
  message: z.string().trim().min(1).max(1000),
});
export type NotifyReplacementsDto = z.infer<typeof notifyReplacementsSchema>;

export const confirmReplacementSchema = z.object({
  workerId: z.string().uuid(),
});
export type ConfirmReplacementDto = z.infer<typeof confirmReplacementSchema>;

export const notifyResultSchema = z.object({
  asked: z.number().int().nonnegative(),
});
export type NotifyResult = z.infer<typeof notifyResultSchema>;
