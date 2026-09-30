import {
  jobDraftSchema,
  type JobDraft,
  type JobDraftRequestInput,
} from '@workflex/shared';
import { api } from './client';

/**
 * One sentence in, a posting out.
 *
 * Nothing is saved by this call. What comes back is a draft for the employer
 * to read, change and post themselves.
 */
export async function draftJob(input: JobDraftRequestInput): Promise<JobDraft> {
  const { data } = await api.post('/jobs/draft', input, {
    // Reading a sentence involves a model call; the default 15s is tight.
    timeout: 60_000,
  });
  return jobDraftSchema.parse(data);
}
