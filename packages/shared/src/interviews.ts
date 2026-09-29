import { z } from 'zod';

/**
 * How the meeting happens.
 *
 * VIDEO is held through this system: the server hands out the room, so
 * neither side has to own a meeting account or send a link by hand.
 * IN_PERSON is what a company representative usually wants — an address and
 * a name to ask for at the desk.
 */
export const interviewModeSchema = z.enum(['VIDEO', 'PHONE', 'IN_PERSON']);
export type InterviewMode = z.infer<typeof interviewModeSchema>;

export const interviewStatusSchema = z.enum([
  'SCHEDULED',
  'ACCEPTED',
  'DECLINED',
  'RESCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;

export const interviewSchema = z.object({
  id: z.string().uuid(),
  mode: interviewModeSchema,
  status: interviewStatusSchema,
  scheduledAt: z.string(),
  durationMinutes: z.number().int().positive(),
  /** Set for a meeting in person. */
  location: z.string().nullable(),
  /**
   * Set for one held online, and only once the candidate has accepted —
   * a room handed out before anyone agreed to attend is a room anyone with
   * the link can sit in.
   */
  meetingUrl: z.string().nullable(),
  interviewerName: z.string().nullable(),
  notes: z.string().nullable(),
  outcome: z.string().nullable(),
  declineReason: z.string().nullable(),
  cancelReason: z.string().nullable(),
  respondedAt: z.string().nullable(),
  createdAt: z.string(),

  job: z.object({ id: z.string().uuid(), title: z.string(), location: z.string() }),
  employer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    /** Null when the employer is hiring for themselves, not a company. */
    company: z.string().nullable(),
  }),
  candidate: z.object({
    id: z.string().uuid(),
    name: z.string(),
    publicId: z.string(),
    phone: z.string(),
  }),
});
export type Interview = z.infer<typeof interviewSchema>;

export const interviewCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  upcoming: z.number().int().nonnegative(),
  today: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  /** Proposed and still waiting on the candidate. */
  awaiting: z.number().int().nonnegative(),
});
export type InterviewCounts = z.infer<typeof interviewCountsSchema>;

export const interviewListSchema = z.object({
  counts: interviewCountsSchema,
  interviews: z.array(interviewSchema),
});
export type InterviewList = z.infer<typeof interviewListSchema>;

/** Which side of the meeting the person asking is on. */
export const interviewSideSchema = z.enum(['HOSTING', 'ATTENDING']);
export type InterviewSide = z.infer<typeof interviewSideSchema>;

export const interviewFilterSchema = z.enum([
  'UPCOMING',
  'TODAY',
  'AWAITING',
  'COMPLETED',
  'CANCELLED',
  'ALL',
]);
export type InterviewFilter = z.infer<typeof interviewFilterSchema>;

export const scheduleInterviewSchema = z
  .object({
    jobId: z.string().uuid(),
    /** Somebody who applied to that job. */
    candidateId: z.string().uuid(),
    mode: interviewModeSchema,
    scheduledAt: z.string().datetime(),
    durationMinutes: z.coerce.number().int().min(10).max(240).default(30),
    /** Required for a meeting in person. */
    location: z.string().trim().max(300).optional(),
    /** An employer's own meeting link, where they would rather use one. */
    meetingUrl: z.string().trim().url().max(500).optional(),
    interviewerName: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((input) => input.mode !== 'IN_PERSON' || Boolean(input.location?.trim()), {
    message: 'Say where to meet',
    path: ['location'],
  })
  .refine((input) => new Date(input.scheduledAt).getTime() > Date.now(), {
    message: 'Pick a time in the future',
    path: ['scheduledAt'],
  });
export type ScheduleInterviewDto = z.output<typeof scheduleInterviewSchema>;
export type ScheduleInterviewInput = z.input<typeof scheduleInterviewSchema>;

export const respondToInterviewSchema = z.object({
  accept: z.boolean(),
  /** Why not, when declining — the employer can then offer another time. */
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});
export type RespondToInterviewDto = z.output<typeof respondToInterviewSchema>;

export const rescheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(10).max(240).optional(),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});
export type RescheduleInterviewDto = z.output<typeof rescheduleInterviewSchema>;

export const cancelInterviewSchema = z.object({
  reason: z.string().trim().min(3, 'Say why, so the other side knows').max(300),
});
export type CancelInterviewDto = z.output<typeof cancelInterviewSchema>;

export const completeInterviewSchema = z.object({
  outcome: z.string().trim().max(1000).optional().or(z.literal('')),
  /** True when nobody turned up. */
  noShow: z.boolean().optional(),
});
export type CompleteInterviewDto = z.output<typeof completeInterviewSchema>;
