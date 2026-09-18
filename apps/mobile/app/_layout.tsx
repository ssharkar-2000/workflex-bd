import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/auth-store';
import { useLaunchStore } from '../src/store/launch-store';
import { useI18nStore } from '../src/i18n';
import { useTheme, useThemeStore } from '../src/lib/use-theme';
import { MeshBackground } from '../src/components/MeshBackground';
import { BrandMark } from '../src/components/BrandMark';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Users are on patchy mobile data; refetching on every focus is costly.
      refetchOnWindowFocus: false,
    },
  },
});

/** Keeps the visible route in step with the session and the launch gate. */
function useAuthRouting(): void {
  const status = useAuthStore((s) => s.status);
  const gateOpen = useLaunchStore((s) => s.gateOpen);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const group = segments[0];
    // Registration now starts before there is a session — the SMS check lives
    // inside the form — so (onboarding) is part of the pre-sign-in flow and
    // must not be bounced back to the landing page.
    const inSignInFlow = group === '(auth)' || group === '(onboarding)';

    // Every cold start begins on the landing page, even with a live session.
    // The gate opens on sign-in, or when a returning user continues from there.
    if (!gateOpen) {
      if (!inSignInFlow) router.replace('/(auth)/welcome');
      return;
    }

    if (status === 'unauthenticated' && !inSignInFlow) {
      router.replace('/(auth)/welcome');
    } else if (status === 'authenticated' && group === '(auth)') {
      router.replace('/(app)/home');
    }
  }, [status, gateOpen, segments, router]);
}

/**
 * React Navigation's palette with the page fill removed. Only `background`
 * changes — everything else is left at the default, because nothing else in
 * this app reads from the navigation theme.
 */
const navBackdrop = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

/**
 * The animated background lives here, once, behind every screen.
 *
 * It used to be rendered by each screen separately, which meant navigating
 * from the landing page to sign-in tore one instance down and built another —
 * every icon jumped back to its starting position mid-transition. Mounted at
 * the root it simply keeps drifting, and the whole flow shares one continuous
 * background instead of a series of restarts.
 */
function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const { c } = useTheme();
  useAuthRouting();

  return (
    <View style={styles.shell}>
      <MeshBackground />

      {status === 'loading' ? (
        // Branded rather than a white card: this is the first frame after the
        // native splash, and a blank screen there reads as a broken app.
        <View style={styles.splash}>
          <BrandMark size={132} interactive={false} />
          <Text style={[styles.splashMark, { color: c.primary }]}>
            WorkFlex BD
          </Text>
        </View>
      ) : (
        // The navigator paints its own container with the navigation theme's
        // `colors.background` — #F2F2F2 by default — on top of everything
        // below it. Clearing `contentStyle` alone is not enough: that only
        // covers the screen card, and the grey container sheet underneath it
        // still hides this background and shifts the page off-palette.
        <ThemeProvider value={navBackdrop}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </ThemeProvider>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: 'transparent' },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: 'transparent',
  },
  splashMark: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
});

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateLocale = useI18nStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    // Language and theme before session: the landing screen renders before
    // anyone is signed in, and it must already be in the user's language and
    // their chosen mode rather than flashing the wrong one.
    void Promise.all([
      hydrateLocale(),
      hydrateTheme(),
    ]).then(() => hydrate());
  }, [hydrate, hydrateLocale, hydrateTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
