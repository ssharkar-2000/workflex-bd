import {
  interviewListSchema,
  interviewSchema,
  type Interview,
  type InterviewFilter,
  type InterviewList,
  type InterviewSide,
  type RespondToInterviewDto,
  type ScheduleInterviewInput,
} from '@workflex/shared';
import { api } from './client';

/** Interviews you are hosting or attending, with the tab counts. */
export async function fetchInterviews(
  side: InterviewSide,
  filter: InterviewFilter,
): Promise<InterviewList> {
  const { data } = await api.get('/interviews/me', { params: { side, filter } });
  return interviewListSchema.parse(data);
}

export async function fetchInterview(id: string): Promise<Interview> {
  const { data } = await api.get(`/interviews/${id}`);
  return interviewSchema.parse(data);
}

/** Invite an applicant to an interview, online or in person. */
export async function scheduleInterview(
  input: ScheduleInterviewInput,
): Promise<Interview> {
  const { data } = await api.post('/interviews', input);
  return interviewSchema.parse(data);
}

/** Accept or decline an invitation. */
export async function respondToInterview(
  id: string,
  body: RespondToInterviewDto,
): Promise<Interview> {
  const { data } = await api.post(`/interviews/${id}/respond`, body);
  return interviewSchema.parse(data);
}

export async function cancelInterview(id: string, reason: string): Promise<Interview> {
  const { data } = await api.post(`/interviews/${id}/cancel`, { reason });
  return interviewSchema.parse(data);
}

export async function completeInterview(id: string, outcome?: string): Promise<Interview> {
  const { data } = await api.post(`/interviews/${id}/complete`, { outcome });
  return interviewSchema.parse(data);
}
