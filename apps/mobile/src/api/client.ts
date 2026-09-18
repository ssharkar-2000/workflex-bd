import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiErrorCode, type ApiError, type AuthTokens } from '@workflex/shared';
import { env } from '../lib/env';
import { useAuthStore } from '../store/auth-store';

/** Bare instance for refresh calls — using `api` here would recurse. */
const plain = axios.create({ baseURL: env.apiUrl, timeout: 15_000 });

export const api: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Single-flight refresh.
 *
 * On a cold start the app fires several requests at once; without this, each
 * 401 would trigger its own refresh, and because refresh tokens rotate, the
 * losers would present an already-rotated token. The server reads that as
 * theft and revokes the whole family — logging the user out for no reason.
 */
let refreshInFlight: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await plain.post<AuthTokens>('/auth/refresh', {
    refreshToken,
  });
  await useAuthStore.getState().setTokens(data);
  return data;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const canRetry =
      status === 401 &&
      config &&
      !config._retried &&
      !config.url?.includes('/auth/refresh') &&
      useAuthStore.getState().refreshToken !== null;

    if (canRetry) {
      config._retried = true;
      try {
        refreshInFlight ??= refreshTokens().finally(() => {
          refreshInFlight = null;
        });
        const tokens = await refreshInFlight;

        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api.request(config);
      } catch {
        // Refresh itself failed: the session is genuinely gone.
        await useAuthStore.getState().signOut();
      }
    } else if (
      status === 401 &&
      useAuthStore.getState().admin !== null
    ) {
      // Admin sessions carry no refresh token — an expired ADMIN_JWT_TTL
      // surfaces as a plain 401 with nothing to retry, so this is the only
      // place that notices and clears it. Without it the app would sit on a
      // dead token, retrying the same 401 on every screen forever.
      await useAuthStore.getState().signOut();
    }

    return Promise.reject(toApiError(error));
  },
);

/**
 * Bearer header for requests that cannot go through this axios instance —
 * `<Image>` fetches the raw bytes itself, so it needs the token handed to it.
 */
export function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Network failures and server errors reach the UI in one shape. */
export function toApiError(error: unknown): ApiError {
  // Idempotent: the response interceptor below already rejects with an
  // ApiError, and screens call this again on whatever they catch. Without
  // this guard the second pass would not recognise its own output and would
  // replace a real message with "Unexpected error".
  if (isApiError(error)) return error;

  if (axios.isAxiosError<ApiError>(error)) {
    if (error.response?.data?.code) return error.response.data;

    if (!error.response) {
      return {
        statusCode: 0,
        code: ApiErrorCode.INTERNAL,
        message:
          'Cannot reach the server. Check your connection and try again.',
      };
    }

    // Prefer whatever the server said over axios's "Request failed with
    // status code 409", which tells the user nothing.
    const body = error.response.data as { message?: string } | undefined;
    return {
      statusCode: error.response.status,
      code: ApiErrorCode.INTERNAL,
      message: body?.message ?? error.message,
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
 * and the UI fell back to a generic message instead of the real reason.
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
