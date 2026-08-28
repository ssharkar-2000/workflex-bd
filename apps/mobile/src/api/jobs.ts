import {
  jobListSchema,
  jobListingSchema,
  type JobFilterState,
  type JobList,
  type JobListing,
} from '@workflex/shared';
import { api } from './client';

export async function fetchJobs(
  filters: JobFilterState,
  cursor?: string,
): Promise<JobList> {
  const { data } = await api.get('/jobs', {
    // Undefined entries are dropped by axios, so an unset filter never
    // reaches the server as the string "undefined".
    params: { ...filters, cursor },
    // Multi-select values go as one comma-joined parameter rather than
    // repeated keys — the server accepts both, and a single key keeps the
    // URL short enough to read in a log.
    paramsSerializer: {
      indexes: null,
      serialize: (params) =>
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => {
            const value = Array.isArray(v) ? v.join(',') : String(v);
            return `${encodeURIComponent(k)}=${encodeURIComponent(value)}`;
          })
          .join('&'),
    },
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
