import {
  adminAuthTokensSchema,
  kycQueueResponseSchema,
  smsOutboxResponseSchema,
  type AdminAuthTokens,
  type KycQueueResponse,
  type SmsOutboxResponse,
} from '@workflex/shared';
import { api } from './client';
import { env } from '../lib/env';
import { useAuthStore } from '../store/auth-store';

export async function adminLogin(
  email: string,
  password: string,
): Promise<AdminAuthTokens> {
  const { data } = await api.post('/auth/admin/login', { email, password });
  return adminAuthTokensSchema.parse(data);
}

export async function fetchKycQueue(): Promise<KycQueueResponse> {
  const { data } = await api.get('/admin/kyc/queue');
  return kycQueueResponseSchema.parse(data);
}

export async function approveKyc(id: string): Promise<void> {
  await api.post(`/admin/kyc/${id}/approve`);
}

export async function rejectKyc(id: string, reason: string): Promise<void> {
  await api.post(`/admin/kyc/${id}/reject`, { reason });
}

/**
 * Returns null rather than throwing when the outbox is unavailable — a 404
 * here just means SMS_PROVIDER is a real gateway, not an admin-facing error.
 */
export async function fetchSmsOutbox(): Promise<SmsOutboxResponse | null> {
  try {
    const { data } = await api.get('/admin/sms/outbox');
    return smsOutboxResponseSchema.parse(data);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return null;
    throw err;
  }
}

/**
 * The document endpoint returns raw bytes, not JSON, so it is loaded straight
 * into an <Image> via a URL rather than through the `api` axios instance.
 * React Native's Image accepts per-request headers, which is how the bearer
 * token reaches an endpoint that Image itself has no auth story for.
 */
export function kycDocumentUrl(userId: string, kind: string): string {
  return `${env.apiUrl}/admin/kyc/${userId}/documents/${kind}`;
}

export function authImageHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
