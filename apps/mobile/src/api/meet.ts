import {
  dayInterviewSchema,
  interviewDaySchema,
  type DayInterview,
  type InterviewDay,
} from '@workflex/shared';
import { api } from './client';

/** One day of interviews, both sides, with the week around it. */
export async function fetchInterviewDay(date: string): Promise<InterviewDay> {
  const { data } = await api.get('/interviews/day', { params: { date } });
  return interviewDaySchema.parse(data);
}

/** Finds one of your own interviews from a code somebody typed or pasted. */
export async function joinByCode(code: string): Promise<DayInterview> {
  const { data } = await api.post('/interviews/join', { code });
  return dayInterviewSchema.parse(data);
}
