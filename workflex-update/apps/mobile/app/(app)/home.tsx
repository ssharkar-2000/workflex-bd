import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, logout } from '../../src/api/auth';
import { updateLocale } from '../../src/api/email';
import { useErrorMessage } from '../../src/lib/error-message';
import { useAuthStore } from '../../src/store/auth-store';
import { useI18nStore, useLocale, useT } from '../../src/i18n';
import { RecommendedForYou } from '../../src/components/jobs/RecommendedForYou';
import { NextSkillAI } from '../../src/components/home/NextSkillAI';
import { TrustScore } from '../../src/components/home/TrustScore';
import { MyHiringActivity } from '../../src/components/home/MyHiringActivity';
import { UpcomingWork } from '../../src/components/home/UpcomingWork';
import { NearbyJobs } from '../../src/components/home/NearbyJobs';
import {
  ActivityOverview,
  useDashboardSummary,
} from '../../src/components/home/DashboardSections';
import { RecentActivity } from '../../src/components/home/RecentActivity';
import { DashboardHeader } from '../../src/components/home/DashboardHeader';
import { RolePicker } from '../../src/components/home/RolePicker';
import { useScrollDirectionHandler } from '../../src/lib/scroll-direction';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

export default function HomeScreen() {
  const t = useT();
  const { c, isDark } = useTheme();
  // Feeds the floating Post a job button, which slides away while the
  // reader is moving down the page so it stops covering card buttons.
  const onScroll = useScrollDirectionHandler();
  const [locale, setLocale] = useLocale();
  const localeChosen = useI18nStore((s) => s.chosen);
  const signOut = useAuthStore((s) => s.signOut);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const errorMessage = useErrorMessage();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });

  // Fetched alongside `me` rather than inside each panel: the counts belong to
  // one request, and a panel that fetched its own would make the dashboard
  // four round trips deep on a phone connection. Undefined while it loads, so
  // the sections that need it simply do not render yet.
  const { data: summary } = useDashboardSummary();

  // The language follows the person, not only the phone. A phone nobody has
  // picked a language on takes the account's, so signing in on a new phone
  // (or after a reinstall) keeps the language they use everywhere else,
  // instead of the default quietly overwriting it. Once one has been picked
  // on this phone, that choice is copied to the account, which is also what
  // server-sent messages (SMS, email) are written in.
  useEffect(() => {
    if (!data || data.locale === locale) return;
    if (localeChosen) {
      void updateLocale(locale).catch(() => undefined);
    } else {
      void setLocale(data.locale);
    }
  }, [data, locale, localeChosen, setLocale]);

  const onSignOut = async () => {
    try {
      await logout(refreshToken ?? undefined);
    } catch {
      // Revoking server-side is best effort; the local session goes either way.
    }
    await signOut();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorTitle, { color: c.text }]}>
          {t('home.loadFailed')}
        </Text>
        <Text style={[styles.errorBody, { color: c.textMuted }]}>
          {errorMessage(error)}
        </Text>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: c.primary }]}
          onPress={() => void refetch()}
        >
          <Text style={[styles.primaryButtonText, { color: c.primaryText }]}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.container}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Buttons in the header's search take a tap while the keyboard is
        // up; the default would spend that tap closing the keyboard.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={c.primary}
          />
        }
      >
        {/* Language, theme and sign out all moved into the header menu — the
            dashboard body is for work, not settings. */}
        <DashboardHeader user={data} onSignOut={() => void onSignOut()} />

        <RolePicker />
        <UpcomingWork />
        <RecommendedForYou />
        <NearbyJobs />
        <MyHiringActivity />
        <NextSkillAI />
        {summary ? <ActivityOverview data={summary} /> : null}
        <TrustScore />
        <RecentActivity />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  container: { padding: space.lg, paddingBottom: space.fab },

  primaryButton: {
    marginTop: space.lg,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: font.md, fontWeight: '600' },

  errorTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    marginBottom: space.sm,
    textAlign: 'center',
  },
  errorBody: { fontSize: font.sm, textAlign: 'center' },
});

