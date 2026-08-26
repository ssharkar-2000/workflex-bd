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
 * React Native's FormData takes a {uri, name, type} object rather than a Blob,
 * and the Content-Type header must be left unset so the runtime can add the
 * multipart boundary itself.
 */
export async function uploadDocument(
  kind: DocumentKind,
  file: { uri: string; name: string; type: string },
): Promise<OnboardingStatus> {
  const form = new FormData();
  form.append('file', file as unknown as Blob);

  const { data } = await api.post(`/onboarding/documents/${kind}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
  return onboardingStatusSchema.parse(data);
}

export async function submitOnboarding(): Promise<OnboardingStatus> {
  const { data } = await api.post('/onboarding/submit');
  return onboardingStatusSchema.parse(data);
}
