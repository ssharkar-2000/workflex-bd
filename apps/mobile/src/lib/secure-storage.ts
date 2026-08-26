import * as SecureStore from 'expo-secure-store';

/**
 * Tokens live in the OS keystore (Keychain / Android Keystore), never in
 * AsyncStorage — AsyncStorage is plain, world-readable-on-root storage, and
 * this app will eventually hold NID data and wallet access.
 */
const KEYS = {
  accessToken: 'workflex.accessToken',
  refreshToken: 'workflex.refreshToken',
  deviceId: 'workflex.deviceId',
  /** Separate from the regular session — never both set at once. */
  adminAccessToken: 'workflex.adminAccessToken',
  adminUser: 'workflex.adminUser',
} as const;

export type SecureKey = keyof typeof KEYS;

export async function getSecure(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS[key]);
  } catch {
    return null;
  }
}

export async function setSecure(key: SecureKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS[key], value);
}

export async function deleteSecure(key: SecureKey): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS[key]);
}

/**
 * A stable per-install id so one device's session can be revoked on its own
 * from a future "signed-in devices" screen.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getSecure('deviceId');
  if (existing) return existing;

  const id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  await setSecure('deviceId', id);
  return id;
}
