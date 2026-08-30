import { cvStatusSchema, type CvStatus } from '@workflex/shared';
import { api } from './client';

export async function fetchCvStatus(): Promise<CvStatus> {
  const { data } = await api.get('/cv');
  return cvStatusSchema.parse(data);
}

/**
 * Uploads and parses in one request.
 *
 * `Content-Type` is deliberately left unset: axios and the platform build the
 * multipart boundary themselves, and naming the type by hand omits it, which
 * makes the server reject the body as malformed.
 */
export async function uploadCv(file: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<CvStatus> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const { data } = await api.post('/cv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Reading a CV involves OCR or a model call; the default 15s is not enough.
    timeout: 120_000,
  });
  return cvStatusSchema.parse(data);
}

export async function removeCv(): Promise<CvStatus> {
  const { data } = await api.delete('/cv');
  return cvStatusSchema.parse(data);
}
