import { Redirect } from 'expo-router';

/**
 * Superseded. The Find-work/Hire choice now lives inline as the "New
 * account" tab on the login screen — see (auth)/login.tsx — so nothing
 * routes here anymore. This only catches a stale deep link or a warm reload
 * holding the old route.
 */
export default function LegacyRoleScreen() {
  return <Redirect href={{ pathname: '/(auth)/login', params: { tab: 'register' } }} />;
}
