import { Platform } from 'react-native';
import {
  courseCompletionsSchema,
  courseSuggestionsSchema,
  type CourseCompletions,
  type CourseSuggestions,
  type DeclareCourseInput,
} from '@workflex/shared';
import { api } from './client';

/**
 * Free courses for the gaps in this account's CV.
 *
 * Generated per request from live postings, so it is not cached hard: a
 * suggestion is only as good as the demand behind it.
 */
export async function fetchCourses(): Promise<CourseSuggestions> {
  const { data } = await api.get('/learning/courses');
  return courseSuggestionsSchema.parse(data);
}

export async function fetchCompletions(): Promise<CourseCompletions> {
  const { data } = await api.get('/learning/completions');
  return courseCompletionsSchema.parse(data);
}

/** "I finished this one." Returns the id to hang a certificate on. */
export async function declareCourse(
  input: DeclareCourseInput,
): Promise<{ id: string }> {
  const { data } = await api.post('/learning/completions', input);
  return data as { id: string };
}

/**
 * The certificate for a finished course.
 *
 * The same two-platform dance as the CV upload: on web the picker hands back
 * a blob URL that has to be fetched into a Blob, on a phone the file object
 * goes straight into the form.
 */
export async function uploadCertificate(
  id: string,
  file: { uri: string; name: string; mimeType: string },
): Promise<void> {
  const form = new FormData();
  const web = Platform.OS === 'web';

  if (web) {
    const blob = await fetch(file.uri).then((response) => response.blob());
    form.append('file', blob, file.name);
  } else {
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }

  await api.post(`/learning/completions/${id}/certificate`, form, {
    headers: {
      // `undefined` removes the client's application/json default in axios 1.x.
      'Content-Type': web ? undefined : 'multipart/form-data',
    },
    timeout: 60_000,
  });
}
