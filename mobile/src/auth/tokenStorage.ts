import * as SecureStore from 'expo-secure-store';

const KEY = 'auth.tokens';

export type Tokens = { accessToken: string; refreshToken: string };

export async function getTokens(): Promise<Tokens | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export async function saveTokens(tokens: Tokens) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(KEY);
}
