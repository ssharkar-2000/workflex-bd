import {
  emailStatusSchema,
  setEmailResponseSchema,
  type EmailStatus,
  type Locale,
  type SetEmailResponse,
} from '@workflex/shared';
import { api } from './client';

export async function fetchEmailStatus(): Promise<EmailStatus> {
  const { data } = await api.get('/me/email');
  return emailStatusSchema.parse(data);
}

export async function setEmail(email: string): Promise<SetEmailResponse> {
  const { data } = await api.post('/me/email', { email });
  return setEmailResponseSchema.parse(data);
}

export async function verifyEmail(code: string): Promise<EmailStatus> {
  const { data } = await api.post('/me/email/verify', { code });
  return emailStatusSchema.parse(data);
}

export async function removeEmail(): Promise<EmailStatus> {
  const { data } = await api.delete('/me/email');
  return emailStatusSchema.parse(data);
}

/** Keeps the account's stored language in step with the device choice. */
export async function updateLocale(locale: Locale): Promise<void> {
  await api.patch('/me/locale', { locale });
}
