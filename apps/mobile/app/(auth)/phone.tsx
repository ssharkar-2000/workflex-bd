import { Redirect } from 'expo-router';

/**
 * Superseded. Phone verification now happens inline on the registration form,
 * so nothing routes here — this only catches a stale deep link or a warm
 * reload holding the old route, and sends it somewhere sensible.
 */
export default function LegacyPhoneScreen() {
  return <Redirect href="/(auth)/login" />;
}
