import {
  applicationStateSchema,
  jobApplicationListSchema,
  jobHighlightsSchema,
  jobListSchema,
  myJobListSchema,
  jobListingSchema,
  type ApplicationState,
  type JobApplicationList,
  type JobFilterState,
  type CreateJobDto,
  type JobHighlights,
  type MyJobList,
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

/** Headline counts plus the most urgent listings, for the top of the feed. */
export async function fetchJobHighlights(): Promise<JobHighlights> {
  const { data } = await api.get('/jobs/highlights');
  return jobHighlightsSchema.parse(data);
}

/** Posting a job, as yourself or as your verified company. */
export async function createJob(dto: CreateJobDto): Promise<JobListing> {
  const { data } = await api.post('/jobs', dto);
  return jobListingSchema.parse(data);
}

export async function fetchMyJobs(): Promise<MyJobList> {
  const { data } = await api.get('/jobs/mine');
  return myJobListSchema.parse(data);
}

/** Closing hides a posting from the feed without destroying it. */
export async function setJobOpen(id: string, isOpen: boolean): Promise<MyJobList> {
  const { data } = await api.patch(`/jobs/${id}/open`, { isOpen });
  return myJobListSchema.parse(data);
}

/**
 * Applying. Returns the resulting state rather than assuming it landed, the
 * same contract as saving — the button reflects the server, not the tap.
 */
export async function applyToJob(
  id: string,
  message?: string,
): Promise<ApplicationState> {
  const { data } = await api.post(`/jobs/${id}/apply`, {
    message: message ?? '',
  });
  return applicationStateSchema.parse(data);
}

export async function withdrawApplication(id: string): Promise<ApplicationState> {
  const { data } = await api.delete(`/jobs/${id}/apply`);
  return applicationStateSchema.parse(data);
}

export async function fetchMyApplications(): Promise<JobApplicationList> {
  const { data } = await api.get('/jobs/applications');
  return jobApplicationListSchema.parse(data);
}
