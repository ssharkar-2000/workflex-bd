import {
  jobListSchema,
  jobListingSchema,
  type JobList,
  type JobListing,
  type JobQuery,
} from '@workflex/shared';
import { api } from './client';

/** Query params, minus the paging fields the caller does not set by hand. */
export type JobFilters = Partial<
  Pick<JobQuery, 'q' | 'category' | 'jobType' | 'workplaceType' | 'savedOnly'>
>;

export async function fetchJobs(
  filters: JobFilters,
  cursor?: string,
): Promise<JobList> {
  const { data } = await api.get('/jobs', {
    // Undefined entries are dropped by axios, so an unset filter never
    // reaches the server as the string "undefined".
    params: { ...filters, cursor },
  });
  return jobListSchema.parse(data);
}

export async function fetchJob(id: string): Promise<JobListing> {
  const { data } = await api.get(`/jobs/${id}`);
  return jobListingSchema.parse(data);
}

/** Returns the resulting state rather than assuming the toggle landed. */
export async function toggleSavedJob(id: string): Promise<boolean> {
  const { data } = await api.post<{ saved: boolean }>(`/jobs/${id}/save`);
  return data.saved;
}

export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  const { data } = await api.get<Record<string, number>>('/jobs/category-counts');
  return data;
}
