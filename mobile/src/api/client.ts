import { getTokens, saveTokens, clearTokens } from '../auth/tokenStorage';

const BASE_URL = 'http://192.168.0.243:3000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
      throw new ApiError(0, netErr.message || 'Network unreachable');
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
    throw new ApiError(res.status, message);
  }

  return data as T;
}