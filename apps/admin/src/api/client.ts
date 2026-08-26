import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiErrorCode, type ApiError } from '@workflex/shared';
import { env } from '../lib/env';
import { useAdminStore } from '../store/admin-store';

export const api: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAdminStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // No refresh token to rotate, so an expired admin session can only be
    // cleared. Without this the app would sit on a dead token and repeat the
    // same 401 on every screen.
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/admin/login') &&
      useAdminStore.getState().accessToken !== null
    ) {
      await useAdminStore.getState().signOut();
    }
    return Promise.reject(toApiError(error));
  },
);

/** Network failures and server errors reach the UI in one shape. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;

  if (axios.isAxiosError<ApiError>(error)) {
    if (error.response?.data?.code) return error.response.data;

    if (!error.response) {
      return {
        statusCode: 0,
        code: ApiErrorCode.INTERNAL,
        message: 'Cannot reach the server.',
      };
    }

    return {
      statusCode: error.response.status,
      code: ApiErrorCode.INTERNAL,
      message: error.message,
    };
  }

  return {
    statusCode: 0,
    code: ApiErrorCode.INTERNAL,
    message: error instanceof Error ? error.message : 'Unexpected error',
  };
}

/**
 * `statusCode` is the discriminator, not `code`.
 *
 * An AxiosError also carries `code` ('ERR_BAD_REQUEST' on a 4xx) and
 * `message`, so duck-typing on those two made every rejected request look
 * like an already-converted ApiError. toApiError then returned it untouched,
 * the UI looked up 'ERR_BAD_REQUEST' in its message table, found nothing, and
 * showed "Something went wrong" in place of the real reason.
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    !axios.isAxiosError(value) &&
    typeof (value as { statusCode?: unknown }).statusCode === 'number' &&
    'code' in value &&
    'message' in value
  );
}
