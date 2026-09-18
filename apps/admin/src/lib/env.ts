import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Same host-derivation trick as the worker app: a handset cannot reach the
 * developer machine's localhost, so the API host is taken from whatever
 * address Metro is already serving this bundle from. That self-heals when the
 * Wi-Fi address changes, which happens constantly on shared networks.
 *
 * Set EXPO_PUBLIC_API_URL to override (tunnel, staging, a colleague's box).
 */
function inferApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000/api/v1`;

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api/v1';
  return 'http://localhost:3000/api/v1';
}

export const env = {
  apiUrl: inferApiUrl(),
  isDev: __DEV__,
} as const;
