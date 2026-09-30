import { calendarSchema, type Calendar } from '@workflex/shared';
import { api } from './client';

/**
 * Shifts and interviews on one calendar, from both sides of the platform.
 *
 * Read-only: anything that changes a shift or an interview goes through its
 * own endpoint, where the rules live.
 */
export async function fetchCalendar(from?: string, to?: string): Promise<Calendar> {
  const { data } = await api.get('/shifts/calendar', { params: { from, to } });
  return calendarSchema.parse(data);
}
