import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminStore } from '../src/store/admin-store';
import { colors } from '../src/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

/**
 * Root gate. Everything below is admin-only, so the check lives here rather
 * than per-screen — a route added later cannot forget it.
 */
function Gate() {
  const status = useAdminStore((s) => s.status);
  const hydrate = useAdminStore((s) => s.hydrate);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status === 'loading') return;
    const onLogin = segments[0] === 'login';

    if (status === 'unauthenticated' && !onLogin) {
      router.replace('/login');
    } else if (status === 'authenticated' && onLogin) {
      router.replace('/(tabs)');
    }
  }, [status, segments, router]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Gate />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
