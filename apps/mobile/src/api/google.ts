import {
  googleConnectUrlSchema,
  googleStatusSchema,
  type GoogleStatus,
} from '@workflex/shared';
import { api } from './client';

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  const { data } = await api.get('/google/status');
  return googleStatusSchema.parse(data);
}

/** The Google consent page, set up to send the browser back to `returnTo`. */
export async function googleConnectUrl(returnTo: string): Promise<string> {
  const { data } = await api.post('/google/connect', { returnTo });
  return googleConnectUrlSchema.parse(data).url;
}

export async function disconnectGoogle(): Promise<GoogleStatus> {
  const { data } = await api.delete('/google');
  return googleStatusSchema.parse(data);
}
