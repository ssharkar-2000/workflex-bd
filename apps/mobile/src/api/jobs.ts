import {
  applicationStateSchema,
  jobApplicationListSchema,
  jobHighlightsSchema,
  jobListSchema,
  myJobListSchema,
  upcomingWorkSchema,
  nearbyJobsSchema,
  jobListingSchema,
  recommendationsSchema,
  type ApplicationState,
  type JobApplicationList,
  type JobFilterState,
  type CreateJobDto,
  type JobHighlights,
  type MyJobList,
  type UpcomingWork,
  type NearbyJobs,
  type LatLng,
  type JobList,
  type JobListing,
  type Recommendations,
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

/**
 * Personalised suggestions for the dashboard.
 *
 * `basis` comes back alongside the items so the screen can say what the
 * suggestions were built from, rather than claiming to know things about
 * someone that it does not.
 */
export async function fetchRecommendations(): Promise<Recommendations> {
  const { data } = await api.get('/jobs/recommended');
  return recommendationsSchema.parse(data);
}

/**
 * Work this account has been accepted for and not yet done.
 *
 * Its own request rather than a slice of the applications list: the dashboard
 * shows this before anything else on a work day, and it must not wait on a
 * list that also carries every rejection and withdrawal.
 */
export async function fetchUpcomingWork(): Promise<UpcomingWork> {
  const { data } = await api.get('/jobs/upcoming');
  return upcomingWorkSchema.parse(data);
}

/**
 * Open work in the area this account gave as its address.
 *
 * `area` is null when the address names nowhere any posting mentions, which
 * the card reports plainly instead of showing an empty list under a heading
 * that promises work nearby.
 */
export async function fetchNearbyJobs(
  origin: LatLng | null,
): Promise<NearbyJobs> {
  // Omitted entirely rather than sent as null: the server treats an absent
  // coordinate as "fall back to the address", and a null would have to mean
  // the same thing through a second code path.
  const params = origin ? { lat: origin.lat, lng: origin.lng } : undefined;
  const { data } = await api.get('/jobs/nearby', { params });
  return nearbyJobsSchema.parse(data);
}
