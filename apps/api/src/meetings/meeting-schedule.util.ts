import { MEETING_JOIN, type MeetingRecurrence, type MeetingRole } from '@workflex/shared';

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Someone who joined and never left is not in the call forever. */
const IN_CALL_STALE_MS = 6 * 60 * MINUTE;

/**
 * The meetings a repeating schedule makes, the first being the slot given.
 *
 * Every occurrence is worked out from the first one rather than from the one
 * before it, so a monthly meeting on the 31st is the 28th in February and the
 * 31st again in March instead of drifting to the 28th for good.
 */
export function expandOccurrences(
  first: Slot,
  recurrence: MeetingRecurrence,
  count: number,
): Slot[] {
  const total = recurrence === 'NONE' ? 1 : Math.max(1, count);
  const length = first.endsAt.getTime() - first.startsAt.getTime();

  return Array.from({ length: total }, (_, i) => {
    const startsAt = shift(first.startsAt, recurrence, i);
    return { startsAt, endsAt: new Date(startsAt.getTime() + length) };
  });
}

function shift(date: Date, recurrence: MeetingRecurrence, i: number): Date {
  switch (recurrence) {
    case 'DAILY':
      return new Date(date.getTime() + i * DAY);
    case 'WEEKLY':
      return new Date(date.getTime() + i * 7 * DAY);
    case 'MONTHLY':
      return addMonthsUtc(date, i);
    default:
      return date;
  }
}

/** Same day of the month, or the last day of a month too short to have it. */
export function addMonthsUtc(date: Date, months: number): Date {
  const out = new Date(date.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, lastDay));
  return out;
}

/** When the door opens and shuts for this side of the meeting. */
export function joinWindow(slot: Slot, role: MeetingRole): { opensAt: Date; closesAt: Date } {
  const early = role === 'HOST' ? MEETING_JOIN.hostEarlyMinutes : MEETING_JOIN.guestEarlyMinutes;
  return {
    opensAt: new Date(slot.startsAt.getTime() - early * MINUTE),
    closesAt: new Date(slot.endsAt.getTime() + MEETING_JOIN.lateMinutes * MINUTE),
  };
}

/** In the call now: went in, has not left since, and did not go in long ago. */
export function isInCall(
  person: { joinedAt: Date | null; leftAt: Date | null },
  now: Date,
): boolean {
  if (!person.joinedAt) return false;
  if (person.leftAt && person.leftAt.getTime() >= person.joinedAt.getTime()) return false;
  return now.getTime() - person.joinedAt.getTime() < IN_CALL_STALE_MS;
}
