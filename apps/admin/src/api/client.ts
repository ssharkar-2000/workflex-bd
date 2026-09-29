import Constants from 'expo-constants';
import { getTokens, clearTokens } from '../auth/tokenStorage';

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
/**
 * The one API this system has — the same server the worker app talks to, so
 * both read and write the same database. `/api/v1` is that server's global
 * prefix (see main.ts).
 */
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (lanHost ? `http://${lanHost}:3000/api/v1/console` : 'http://localhost:3000/api/v1/console');
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
  | 'INVALID_CREDENTIALS'
  | 'SERVER_ERROR';

/**
 * The codes this app can turn into a sentence.
 *
 * The API has many more than these — it was built for the worker app, and
 * its vocabulary is its own. An unknown code used to be taken at face value
 * and then failed to match any message, so a wrong password (401
 * INVALID_CREDENTIALS) came out as "something went wrong on our side": a
 * server fault, for what is simply a typo. Anything not in this set now
 * falls back to the HTTP status, which every server agrees on.
 */
const KNOWN_CODES = new Set<string>([
  'OFFLINE',
  'TIMEOUT',
  'SESSION_EXPIRED',
  'NOT_ALLOWED',
  'NOT_FOUND',
  'DUPLICATE',
  'INVALID_REQUEST',
  'LINKED_RECORD_MISSING',
  'TOO_MANY_REQUESTS',
  'SERVICE_UNAVAILABLE',
  'INVALID_CREDENTIALS',
  'SERVER_ERROR',
]);

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
function codeForStatus(status: number, hadToken: boolean): ApiErrorCode {
  if (status === 0) return 'OFFLINE';
  // A 401 while signing in is a wrong password; a 401 with a token in hand
  // is a session that has run out. Same status, opposite advice.
  if (status === 401) return hadToken ? 'SESSION_EXPIRED' : 'INVALID_CREDENTIALS';
  if (status === 403) return 'NOT_ALLOWED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'DUPLICATE';
  if (status === 429) return 'TOO_MANY_REQUESTS';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'SERVER_ERROR';
  return 'INVALID_REQUEST';
}

/** The server's own code, when this app has a sentence for it. */
function knownCode(code: unknown): ApiErrorCode | null {
  return typeof code === 'string' && KNOWN_CODES.has(code)
    ? (code as ApiErrorCode)
    : null;
}

/**
 * There is no token refresh here.
 *
 * Admin sign-in returns a single short-lived token and no refresh token —
 * these accounts are for review work, not left open on a handset for weeks,
 * so an expiry means signing in again. A 401 therefore clears the session
 * rather than trying to renew it.
 */
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

  const token = auth ? (await getTokens())?.accessToken : null;
  const res = await send(token);

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
      knownCode(data?.code) ?? codeForStatus(res.status, Boolean(token)),
      data?.reference,
    );
  }

  return data as T;
}