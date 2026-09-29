import {
  hireCompletedSchema,
  hireListSchema,
  type HireCompleted,
  type HireList,
  type ReviewRole,
} from '@workflex/shared';
import { api } from './client';

/**
 * Hires grouped by job. As RECRUITER: the people you hired who are still
 * working. As WORKER: the recruiters who hired you.
 */
export async function fetchHires(as: ReviewRole): Promise<HireList> {
  const { data } = await api.get('/hires', { params: { as } });
  return hireListSchema.parse(data);
}

/** Recruiter only: the job is finished for this person. */
export async function completeHire(jobId: string, workerId: string): Promise<HireCompleted> {
  const { data } = await api.post(`/hires/${jobId}/${workerId}/complete`);
  return hireCompletedSchema.parse(data);
}
