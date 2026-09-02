import { Platform } from 'react-native';
import { cvStatusSchema, type CvStatus } from '@workflex/shared';
import { api } from './client';

export async function fetchCvStatus(): Promise<CvStatus> {
  const { data } = await api.get('/cv');
  return cvStatusSchema.parse(data);
}

/**
 * Uploads and parses in one request.
 *
 * The two platforms need different bodies, which is why this is not one path
 * with a cast — the same split as `uploadDocument` in ./onboarding.
 *
 * React Native's FormData takes a `{uri, name, type}` object and resolves the
 * file natively. A browser does not: appending a plain object runs it through
 * `String()`, so the request carried the literal text `[object Object]` where
 * the server expected a file, and the API answered "No file was uploaded" — a
 * 404 the app showed as "we could not find what you were looking for".
 *
 * The header differs for the same reason. Multipart needs a boundary that only
 * the runtime can generate, and naming the type without one leaves the body
 * unparseable. The comment that used to sit here said exactly that, while the
 * code set the header anyway.
 */
export async function uploadCv(file: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<CvStatus> {
  const form = new FormData();
  const web = Platform.OS === 'web';

  if (web) {
    // The picker hands back a blob: or data: URL on web; fetching it is the
    // supported way to turn either into the Blob FormData needs.
    const blob = await fetch(file.uri).then((response) => response.blob());
    form.append('file', blob, file.name);
  } else {
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }

  const { data } = await api.post('/cv', form, {
    headers: {
      // `undefined` removes the client's application/json default in axios 1.x.
      // Native keeps the explicit type it has always sent.
      'Content-Type': web ? undefined : 'multipart/form-data',
    },
    // Reading a CV involves OCR or a model call; the default 15s is not enough.
    timeout: 120_000,
  });
  return cvStatusSchema.parse(data);
}

export async function removeCv(): Promise<CvStatus> {
  const { data } = await api.delete('/cv');
  return cvStatusSchema.parse(data);
}
