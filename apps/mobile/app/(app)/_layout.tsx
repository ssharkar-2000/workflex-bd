import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchOnboardingStatus } from '../../src/api/onboarding';
import { useLaunchStore } from '../../src/store/launch-store';
import { BottomNav } from '../../src/components/BottomNav';
import { useTheme } from '../../src/lib/use-theme';

/**
 * Gate for the signed-in area.
 *
 * The bar is a *complete profile*, not a submitted KYC application. Someone
 * who registered — name, address, account type, password — has given
 * everything the account needs to exist, so signing in takes them to the
 * dashboard. Uploading an NID is verification, not registration: the
 * dashboard already renders for an unverified account (tiles above level 1
 * stay locked and the verification card offers the next step), so bouncing
 * them back into the wizard only re-asked questions they had answered.
 *
 * The check lives here rather than in each screen so a new screen added
 * later cannot accidentally skip it.
 */
export default function AppLayout() {
  const gateOpen = useLaunchStore((s) => s.gateOpen);
  const { c } = useTheme();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
    retry: 1,
    // Nothing here should run before the user has come through the landing
    // sequence, or its redirect races the gate and wins.
    enabled: gateOpen,
  });

  if (!gateOpen) return <Redirect href="/(auth)/welcome" />;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // On a failed status call, let the user through rather than trapping them in
  // a spinner; the home screen surfaces its own error state.
  // One registration form, so there is exactly one place to resume from.
  if (!isError && data && !data.profileComplete) {
    return <Redirect href="/(onboarding)/details" />;
  }

  // The bar is a sibling of the Stack, not an overlay on it, so the screens
  // keep their full height and none of them has to reserve room for it.
  return (
    <View style={styles.shell}>
      <View style={styles.shell}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <BottomNav />
    </View>
  );
}

const styles = {
  shell: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
