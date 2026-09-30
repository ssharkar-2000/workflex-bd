import { z } from 'zod';

/**
 * One thing on a person's calendar.
 *
 * Shifts and interviews are different tables with different rules, but to
 * somebody looking at their week they are the same kind of object: a time,
 * a job, and another person. This is that shared view — it is built for
 * reading, never written to.
 */
export const calendarKindSchema = z.enum(['SHIFT', 'INTERVIEW']);
export type CalendarKind = z.infer<typeof calendarKindSchema>;

/** Which side of it this account is on. */
export const calendarRoleSchema = z.enum(['WORKER', 'EMPLOYER']);
export type CalendarRole = z.infer<typeof calendarRoleSchema>;

export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  kind: calendarKindSchema,
  role: calendarRoleSchema,
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  /** The underlying row's own status, as its screen words it. */
  status: z.string(),
  /** Where to be, or how to join. Null when neither applies yet. */
  location: z.string().nullable(),
  meetingUrl: z.string().nullable(),
  /** For an interview: VIDEO, PHONE or IN_PERSON. Null for a shift. */
  mode: z.string().nullable(),
  /** What a shift pays, in paisa. Null for an interview. */
  pay: z.number().int().nullable(),
  notes: z.string().nullable(),

  job: z.object({ id: z.string().uuid(), title: z.string() }),
  /** The other person: who the meeting is with, or who the work is for. */
  counterpart: z.object({
    id: z.string().uuid(),
    name: z.string(),
    publicId: z.string(),
    phone: z.string().nullable(),
    company: z.string().nullable(),
  }),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarSchema = z.object({
  /** The window these events cover, as the server read it. */
  from: z.string(),
  to: z.string(),
  events: z.array(calendarEventSchema),
});
export type Calendar = z.infer<typeof calendarSchema>;

export const calendarQuerySchema = z.object({
  /** ISO dates. Defaults to the month around today. */
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type CalendarQuery = z.output<typeof calendarQuerySchema>;
