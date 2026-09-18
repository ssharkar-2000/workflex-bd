import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';
import { useLaunchStore } from '../src/store/launch-store';

/**
 * Entry route.
 *
 * Always lands on the welcome screen, session or not. The launch gate is
 * in-memory, so every cold start walks the same sequence — landing, role,
 * phone, OTP — rather than dropping a returning user into the middle of a
 * half-finished registration. Welcome offers a one-tap way back in when a
 * session already exists.
 */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const gateOpen = useLaunchStore((s) => s.gateOpen);

  if (status === 'loading') return null;

  if (!gateOpen) return <Redirect href="/(auth)/welcome" />;

  return status === 'authenticated' ? (
    <Redirect href="/(app)/home" />
  ) : (
    <Redirect href="/(auth)/welcome" />
  );
}
