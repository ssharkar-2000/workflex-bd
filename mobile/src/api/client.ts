import Constants from 'expo-constants';
import { getTokens, saveTokens, clearTokens } from '../auth/tokenStorage';

/// EXPO_PUBLIC_API_URL still wins if you set it explicitly (useful for a
/// tunnel/production URL). Otherwise, instead of a hardcoded LAN IP that
/// breaks every time you switch networks (home WiFi vs. phone's mobile
/// hotspot vs. office WiFi), we derive the backend host automatically from
/// the address Expo's dev server used to reach the phone — that address is
/// always on whichever network the phone is currently connected through,
/// so a mobile hotspot works with zero config changes.
function detectLanHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

const lanHost = detectLanHost();
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (lanHost ? `http://${lanHost}:3000/api` : 'http://localhost:3000/api');
export { BASE_URL };

/**
 * Item 14 — every failure the app can hit now arrives as a stable `code` next
 * to the message, so a screen can show a translated, human sentence instead
 * of whatever text the server happened to send (or, for a dropped
 * connection, instead of a raw "Network request failed").
 *
 * `code` mirrors the keys the backend's FriendlyExceptionFilter emits, plus
 * `OFFLINE` for failures that never reached the server at all. `reference` is
 * the short id the server logged alongside the real stack, so a user can
 * quote it to support.
 */
export type ApiErrorCode =
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'INVALID_REQUEST'
  | 'LINKED_RECORD_MISSING'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: ApiErrorCode = 'SERVER_ERROR',
    public reference?: string,
  ) {
    super(message);
  }
}

/// Fallback used when the server sent a status but no usable code — keeps a
/// bare 502 from an intermediate proxy readable too.
function codeForStatus(status: number): ApiErrorCode {
  if (status === 0) return 'OFFLINE';
  if (status === 401) return 'SESSION_EXPIRED';
  if (status === 403) return 'NOT_ALLOWED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'DUPLICATE';
  if (status === 429) return 'TOO_MANY_REQUESTS';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'SERVER_ERROR';
  return 'INVALID_REQUEST';
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refreshToken) {
        return null;
      }

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!res.ok) {
        // 🟢 শুধুমাত্র ৪০১ বা ৪০৩ (ইনভ্যালিড টোকেন) হলেই টোকেন ক্লিয়ার হবে
        if (res.status === 401 || res.status === 403) {
          await clearTokens();
        }
        return null;
      }

      const next = await res.json();
      if (next?.accessToken) {
        await saveTokens(next);
        return next.accessToken as string;
      }
      return null;
    } catch (err) {
      // 🟢 নেটওয়ার্ক ড্রপ করলে টোকেন ডিলিট না করে সাইলেন্টলি নাল রিটার্ন করবে
      console.log('Background token refresh network error:', err);
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const send = async (token?: string | null) => {
    try {
      return await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (netErr: any) {
      // 🟢 ব্যাকগ্রাউন্ড নেটওয়ার্ক ড্রপ করলে ফ্যাটাল ক্র্যাশ না ঘটিয়ে হ্যান্ডেল করা
      //
      // Item 14: the raw message here is things like "Network request
      // failed" or a DNS error string — never shown to anyone. The screen
      // reads `code` and renders its own sentence.
      throw new ApiError(
        0,
        'Could not reach the server. Check your connection and try again.',
        'OFFLINE',
      );
    }
  };

  let token = auth ? (await getTokens())?.accessToken : null;
  let res = await send(token);

  if (res.status === 401 && auth) {
    token = await refreshAccessToken();
    if (token) {
      res = await send(token);
    }
  }

  let text = '';
  try {
    text = await res.text();
  } catch {
    text = '';
  }

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    // 🟢 ব্যাকগ্রাউন্ডে ইনভ্যালিড সেশনের কারণে ৪০১ পেলে তবেই ক্লিয়ার করবে
    if (res.status === 401) {
      await clearTokens();
    }
    const message = Array.isArray(data?.message)
      ? data.message[0]
      : data?.message ?? 'Something went wrong. Try again.';
    throw new ApiError(
      res.status,
      message,
      (data?.code as ApiErrorCode) ?? codeForStatus(res.status),
      data?.reference,
    );
  }

  return data as T;
}