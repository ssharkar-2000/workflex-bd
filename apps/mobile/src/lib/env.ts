import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolving the API base URL.
 *
 * The milestone for this phase is signing in from a *physical handset*, and a
 * handset cannot reach the laptop's `localhost`. So we fall back to the LAN IP
 * that Metro is already serving from, which is correct on a real device
 * without anyone editing a config file.
 *
 * Set EXPO_PUBLIC_API_URL to override (staging, tunnels, a colleague's box).
 */
function inferDevApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  // e.g. "192.168.0.14:8081" — the host Metro told the device to load from.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000/api/v1`;

  // Android emulator maps the host machine to 10.0.2.2, not 127.0.0.1.
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api/v1';
  return 'http://localhost:3000/api/v1';
}

export const env = {
  apiUrl: inferDevApiUrl(),
  isDev: __DEV__,
} as const;
