import {
  availabilityChangedSchema,
  replacementAssignedSchema,
  replacementOptionsSchema,
  type AvailabilityChanged,
  type MarkUnavailableInput,
  type ReplacementAssigned,
  type ReplacementOptions,
} from '@workflex/shared';
import { api } from './client';

/**
 * A hired worker cannot do the job. Either side may say it: pass the worker's
 * own id when it is the worker speaking, or the hired person's id when it is
 * the employer.
 */
export async function markUnavailable(
  jobId: string,
  workerId: string,
  input: MarkUnavailableInput,
): Promise<AvailabilityChanged> {
  const { data } = await api.post(`/hires/${jobId}/${workerId}/unavailable`, input);
  return availabilityChangedSchema.parse(data);
}

/** They are available after all. Only until somebody has been assigned. */
export async function markAvailable(jobId: string, workerId: string): Promise<AvailabilityChanged> {
  const { data } = await api.delete(`/hires/${jobId}/${workerId}/unavailable`);
  return availabilityChangedSchema.parse(data);
}

/** The Replacement Matcher: who on the shortlist could take this worker's place. */
export async function fetchReplacementOptions(
  jobId: string,
  workerId: string,
): Promise<ReplacementOptions> {
  const { data } = await api.get(`/hires/${jobId}/${workerId}/replacements`);
  return replacementOptionsSchema.parse(data);
}

/** Assign as Replacement: the chosen candidate becomes the hired worker. */
export async function assignReplacement(
  jobId: string,
  workerId: string,
  replacementId: string,
): Promise<ReplacementAssigned> {
  const { data } = await api.post(`/hires/${jobId}/${workerId}/replace`, { replacementId });
  return replacementAssignedSchema.parse(data);
}
