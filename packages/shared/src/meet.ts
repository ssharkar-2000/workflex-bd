import { z } from 'zod';
import { interviewSchema, interviewSideSchema } from './interviews';

/**
 * The meeting room view of interviews: a day at a time, with a way in.
 *
 * Two people use this screen for opposite reasons. Somebody hiring opens it
 * to start a meeting they arranged; somebody applying opens it to get into
 * one they were invited to. Both want the same three things on the screen —
 * what is on today, a way to jump between days, and a button that works when
 * the time comes — so it is one screen rather than two.
 */

/** How long before the start the Join button goes live. */
export const JOIN_OPENS_MINUTES = 10;

export const dayInterviewSchema = interviewSchema.extend({
  /** Which end of it this account is on. */
  side: interviewSideSchema,
  /**
   * A short code for the meeting, in the shape people are used to typing.
   *
   * Derived from the interview's id rather than stored, so it needs no
   * column and cannot drift out of step with the row it names. It is also
   * only ever resolved against the interviews the person asking is already
   * part of — see resolveByCode in the API. That is a deliberate difference
   * from a public meeting service: the code is a convenience for finding
   * your own interview, never a key that admits a stranger to it.
   */
  code: z.string(),
  /**
   * Whether the button should be live now.
   *
   * True from ten minutes before the start until the end. Not simply "is it
   * today": a button that looks ready six hours early gets pressed six hours
   * early, and somebody sits in an empty room wondering if they have the
   * wrong day.
   */
  joinable: z.boolean(),
});
export type DayInterview = z.infer<typeof dayInterviewSchema>;

export const weekDaySchema = z.object({
  /** YYYY-MM-DD. */
  date: z.string(),
  /** How many interviews that day, for the dot under the number. */
  count: z.number().int().nonnegative(),
});
export type WeekDay = z.infer<typeof weekDaySchema>;

export const interviewDaySchema = z.object({
  date: z.string(),
  interviews: z.array(dayInterviewSchema),
  /** The seven days shown in the strip, Monday first. */
  week: z.array(weekDaySchema),
  /** Interviews after today, so an empty day can say when the next one is. */
  nextUp: dayInterviewSchema.nullable(),
});
export type InterviewDay = z.infer<typeof interviewDaySchema>;

export const joinInterviewSchema = z.object({
  /**
   * A code as typed, or a full meeting link pasted in.
   *
   * Both are accepted because both are what people have to hand: the code
   * from a notification, the link from a message. Normalising happens on the
   * server so the two paths cannot drift apart.
   */
  code: z.string().trim().min(3).max(200),
});
export type JoinInterviewDto = z.infer<typeof joinInterviewSchema>;

/**
 * The meeting code for an interview id: "hqx-mfkd-trv".
 *
 * Three groups of letters, no digits and no vowels. Digits are left out
 * because a code is read aloud over a phone as often as it is typed, and
 * "0/o" and "1/l" cost a call. Vowels are left out so the generator cannot
 * produce a word somebody would rather not read out.
 *
 * Implemented here in shared rather than in the API so the app can show a
 * code without asking for one, and so both sides can never disagree about
 * what an interview's code is.
 */
export function meetingCode(interviewId: string): string {
  const letters = 'bcdfghjkmnpqrstvwxyz';
  // A cheap, stable hash over the id. Not cryptographic and not trying to
  // be: the code is a lookup key among a person's own interviews, not a
  // secret, and the authorisation is done by the query that uses it.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < interviewId.length; i += 1) {
    const ch = interviewId.charCodeAt(i);
    h1 = ((h1 ^ ch) * 0x01000193) >>> 0;
    h2 = ((h2 + ch * (i + 7)) * 0x85ebca6b) >>> 0;
  }

  const take = (seed: number, n: number) => {
    let value = seed;
    let out = '';
    for (let i = 0; i < n; i += 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      out += letters[value % letters.length];
    }
    return out;
  };

  return `${take(h1, 3)}-${take(h1 ^ h2, 4)}-${take(h2, 3)}`;
}

/** Pulls a code out of whatever somebody pasted: a code, or a link ending in one. */
export function readCode(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(/[bcdfghjkmnpqrstvwxyz]{3}-[bcdfghjkmnpqrstvwxyz]{4}-[bcdfghjkmnpqrstvwxyz]{3}/);
  if (match) return match[0];
  // A link with the code as its last segment, or the code with the dashes
  // left out, which is how people type when they are in a hurry.
  const tail = trimmed.split(/[/?#]/).filter(Boolean).pop() ?? trimmed;
  const bare = tail.replace(/[^bcdfghjkmnpqrstvwxyz]/g, '');
  if (bare.length === 10) return `${bare.slice(0, 3)}-${bare.slice(3, 7)}-${bare.slice(7)}`;
  return trimmed;
}
