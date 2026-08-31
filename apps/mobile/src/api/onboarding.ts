import { Platform } from 'react-native';
import {
  onboardingStatusSchema,
  type DocumentKind,
  type OnboardingProfileInput,
  type OnboardingStatus,
} from '@workflex/shared';
import { api } from './client';

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const { data } = await api.get('/onboarding/status');
  return onboardingStatusSchema.parse(data);
}

export async function saveOnboardingProfile(
  input: OnboardingProfileInput,
): Promise<OnboardingStatus> {
  const { data } = await api.post('/onboarding/profile', input);
  return onboardingStatusSchema.parse(data);
}

/**
 * Uploads one identity document.
 *
 * The two platforms need genuinely different bodies, which is why this is not
 * one code path with a cast.
 *
 * React Native's FormData accepts a `{uri, name, type}` object and resolves the
 * file natively. A browser does not: appending a plain object runs it through
 * `String()`, so the request carried the literal text `[object Object]` in a
 * field where the server expected a file, and the API correctly answered "No
 * file was uploaded" — a 404 the app then showed as "not found".
 *
 * The header differs for the same reason. Multipart bodies need a boundary
 * parameter that only the runtime can generate; naming the type without one
 * leaves the server unable to parse the body at all. On web the header is
 * therefore cleared so the browser can fill it in, boundary included.
 */
export async function uploadDocument(
  kind: DocumentKind,
  file: { uri: string; name: string; type: string },
): Promise<OnboardingStatus> {
  const form = new FormData();
  const web = Platform.OS === 'web';

  if (web) {
    // The picker hands back a blob: or data: URL on web; fetching it is the
    // supported way to turn either into the Blob FormData needs.
    const blob = await fetch(file.uri).then((response) => response.blob());
    form.append('file', blob, file.name);
  } else {
    form.append('file', file as unknown as Blob);
  }

  const { data } = await api.post(`/onboarding/documents/${kind}`, form, {
    headers: {
      // `undefined` removes the client's application/json default in axios 1.x.
      // Native keeps the explicit type it has always sent, so this change
      // cannot affect the platform it already worked on.
      'Content-Type': web ? undefined : 'multipart/form-data',
    },
    timeout: 60_000,
  });
  return onboardingStatusSchema.parse(data);
}

export async function submitOnboarding(): Promise<OnboardingStatus> {
  const { data } = await api.post('/onboarding/submit');
  return onboardingStatusSchema.parse(data);
}
