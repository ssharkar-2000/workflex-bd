import { applyDraftSchema, type ApplyDraft } from '@workflex/shared';
import { api } from './client';

/**
 * One-Click Apply: the note for this job, from the account's CV and profile.
 *
 * Nothing is applied for by this call. What comes back is a draft the person
 * reads, edits and sends by pressing Apply.
 */
export async function draftApplication(jobId: string): Promise<ApplyDraft> {
  const { data } = await api.post(`/jobs/${jobId}/apply-draft`, undefined, {
    // A model call; the default 15s is tight.
    timeout: 60_000,
  });
  return applyDraftSchema.parse(data);
}
