// Browser stand-in for tokenStorage.ts, picked up automatically by Metro on
// web. expo-secure-store wraps the phone's keychain and throws in a browser,
// so on web the tokens live in localStorage instead. Native builds are
// unaffected and keep using tokenStorage.ts.

const KEY = 'auth.tokens';
const ADMIN_KEY = 'auth.admin';

export type Tokens = { accessToken: string; refreshToken?: string };

export async function getTokens(): Promise<Tokens | null> {
  const raw = globalThis.localStorage?.getItem(KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export async function saveTokens(tokens: Tokens) {
  globalThis.localStorage?.setItem(KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  globalThis.localStorage?.removeItem(KEY);
  globalThis.localStorage?.removeItem(ADMIN_KEY);
}

export async function getStoredAdmin<T>(): Promise<T | null> {
  const raw = globalThis.localStorage?.getItem(ADMIN_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function saveStoredAdmin(admin: unknown) {
  globalThis.localStorage?.setItem(ADMIN_KEY, JSON.stringify(admin));
}
