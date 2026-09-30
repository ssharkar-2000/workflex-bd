import type { CalendarEvent } from '@workflex/shared';

/**
 * What a calendar entry means to the person looking at it today.
 *
 * Shifts and interviews keep their own statuses — CONFIRMED, ACCEPTED,
 * NO_SHOW, DECLINED and the rest — and none of them answer the question
 * somebody actually asks a calendar: is this still coming, or did I miss it?
 * That answer needs the clock as well as the status, because a shift still
 * marked CONFIRMED three days after it ended was not attended, whatever the
 * row says.
 */
export type EventState = 'UPCOMING' | 'MISSED' | 'DONE' | 'CANCELLED';

/** It happened. */
const FINISHED = new Set(['COMPLETED']);

/**
 * It is not happening, and that is nobody's fault.
 *
 * RESCHEDULED belongs here: the row is kept for its history and a new one
 * carries the real time, so showing the old one as upcoming would put a
 * person somewhere nobody is expecting them.
 */
const CALLED_OFF = new Set(['CANCELLED', 'DECLINED', 'RESCHEDULED']);

export function eventState(event: CalendarEvent, now: Date = new Date()): EventState {
  if (event.status === 'NO_SHOW') return 'MISSED';
  if (FINISHED.has(event.status)) return 'DONE';
  if (CALLED_OFF.has(event.status)) return 'CANCELLED';

  // Anything still expected — and anything with a status this app does not
  // know — is missed once its end time has gone by. Treating an unknown
  // status as upcoming forever is the failure that matters here: it hides a
  // missed shift, and a hidden missed shift is one nobody follows up.
  const ends = Date.parse(event.endsAt);
  return Number.isFinite(ends) && ends < now.getTime() ? 'MISSED' : 'UPCOMING';
}

/** How many of each state fall on one day, for the marks under its date. */
export function countStates(
  events: CalendarEvent[],
  now: Date = new Date(),
): Record<EventState, number> {
  const counts: Record<EventState, number> = {
    UPCOMING: 0,
    MISSED: 0,
    DONE: 0,
    CANCELLED: 0,
  };
  for (const event of events) counts[eventState(event, now)] += 1;
  return counts;
}
