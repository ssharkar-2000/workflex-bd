import {
  authSessionSchema,
  authUserSchema,
  otpRequestResponseSchema,
  type AuthSession,
  type AuthUser,
  type OtpPurpose,
  type OtpRequestResponse,
} from '@workflex/shared';
import { api } from './client';
import { getOrCreateDeviceId } from '../lib/secure-storage';

/**
 * Responses are parsed through the same schemas the API validates against, so
 * a contract change surfaces here as a clear error instead of an undefined
 * field three screens later.
 */
export async function requestOtp(
  phone: string,
  purpose: OtpPurpose = 'LOGIN',
): Promise<OtpRequestResponse> {
  const { data } = await api.post('/auth/otp/request', { phone, purpose });
  return otpRequestResponseSchema.parse(data);
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose = 'LOGIN',
): Promise<AuthSession> {
  const deviceId = await getOrCreateDeviceId();
  const { data } = await api.post('/auth/otp/verify', {
    phone,
    code,
    purpose,
    deviceId,
  });
  return authSessionSchema.parse(data);
}

export async function login(
  phone: string,
  password: string,
): Promise<AuthSession> {
  const deviceId = await getOrCreateDeviceId();
  const { data } = await api.post('/auth/login', { phone, password, deviceId });
  return authSessionSchema.parse(data);
}

export async function requestPasswordReset(phone: string): Promise<void> {
  await api.post('/auth/password/reset/request', { phone });
}

export async function confirmPasswordReset(input: {
  phone: string;
  code: string;
  password: string;
  confirmPassword: string;
}): Promise<void> {
  await api.post('/auth/password/reset/confirm', input);
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get('/me');
  return authUserSchema.parse(data);
}

export async function logout(refreshToken?: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken, allDevices: false });
}
