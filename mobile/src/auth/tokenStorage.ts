import * as SecureStore from 'expo-secure-store';

const KEY = 'auth.tokens';
const ADMIN_KEY = 'auth.admin';

/**
 * `refreshToken` stays in the shape for the screens that read it, but this
 * API never issues one: an admin token is short-lived by design and expiry
 * means signing in again (see AdminAuthService in the API).
 */
export type Tokens = { accessToken: string; refreshToken?: string };

export async function getTokens(): Promise<Tokens | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export async function saveTokens(tokens: Tokens) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(KEY);
  await SecureStore.deleteItemAsync(ADMIN_KEY);
}

/**
 * Who is signed in, kept beside the token.
 *
 * The API returns the account with the token and has no "who am I" endpoint
 * for admins, so the answer is stored here rather than re-fetched on launch.
 */
export async function getStoredAdmin<T>(): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(ADMIN_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function saveStoredAdmin(admin: unknown) {
  await SecureStore.setItemAsync(ADMIN_KEY, JSON.stringify(admin));
}
