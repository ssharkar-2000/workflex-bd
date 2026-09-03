import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, logout } from '../../src/api/auth';
import { updateLocale } from '../../src/api/email';
import { useErrorMessage } from '../../src/lib/error-message';
import { useAuthStore } from '../../src/store/auth-store';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
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
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

export default function HomeScreen() {
  const t = useT();
  const { c, isDark } = useTheme();
  const [locale] = useLocale();
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

  // The device is the source of truth for language; the account copy exists so
  // server-sent messages (SMS, email) match what the user reads in the app.
  useEffect(() => {
    if (data && data.locale !== locale) {
      void updateLocale(locale).catch(() => undefined);
    }
  }, [data, locale]);

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

function RolePicker() {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t('home.roles.title')}
      </Text>
      <View style={styles.roleRow}>
        <RoleCard
          emoji="🔎"
          title="home.role.find"
          body="home.role.findBody"
          tint={0}
          href="/(app)/jobs"
          cta="home.role.browse"
        />
        <RoleCard
          emoji="📋"
          title="home.role.hire"
          body="home.role.hireBody"
          tint={2}
          href="/(app)/post-job"
          cta="home.role.post"
        />
      </View>
      <Text style={[styles.sectionNote, { color: c.textMuted }]}>
        {t('home.roles.note')}
      </Text>
    </View>
  );
}

function RoleCard({
  emoji,
  title,
  body,
  tint,
  href,
  cta,
}: {
  emoji: string;
  title: TranslationKey;
  body: TranslationKey;
  /** Index into the palette's tint set — peach, mint, lavender, butter. */
  tint: number;
  /** Omitted while the destination does not exist; the card then shows "soon". */
  href?: string;
  cta: TranslationKey;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  // A card with somewhere to go is a button and dips on press; one without is
  // not, so it never offers a tap that does nothing.
  const Wrapper = href ? Pressable : View;

  return (
    <Wrapper
      onPress={href ? () => router.push(href as never) : undefined}
      accessibilityRole={href ? 'button' : undefined}
      style={({ pressed }: { pressed?: boolean } = {}) => [
        styles.roleCard,
        {
          backgroundColor: c.tints[tint % c.tints.length],
          borderColor: c.tintBorders[tint % c.tintBorders.length],
        },
        pressed && styles.rolePressed,
      ]}
    >
      <Text style={styles.roleEmoji}>{emoji}</Text>
      <Text style={[styles.roleTitle, { color: c.text }]}>{t(title)}</Text>
      <Text style={[styles.roleBody, { color: c.textMuted }]}>{t(body)}</Text>
      {href ? (
        <Text style={[styles.roleGo, { color: c.primary }]}>
          {t(cta)} →
        </Text>
      ) : (
        <View
          style={[
            styles.soonPill,
            { backgroundColor: c.surfaceAlt, borderColor: c.border },
          ]}
        >
          <Text style={[styles.soonPillText, { color: c.textMuted }]}>
            {t('common.comingNext')}
          </Text>
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  container: { padding: space.lg, paddingBottom: space.xl },


  section: { marginTop: space.lg },
  sectionTitle: { fontSize: font.md, fontWeight: '700', marginBottom: space.md },
  sectionNote: { marginTop: space.sm, fontSize: font.xs },

  roleRow: { flexDirection: 'row', gap: space.md },
  roleCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
  },
  roleEmoji: { fontSize: 26, marginBottom: space.sm },
  roleTitle: { fontSize: font.md, fontWeight: '700' },
  // Two lines on both cards, so neither is taller than the other and the row
  // reads as an even split rather than two boxes that happen to be adjacent.
  roleBody: {
    fontSize: font.xs,
    marginTop: space.xs,
    lineHeight: 18,
    minHeight: 36,
  },

  soonPill: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  soonPillText: { fontSize: font.xs, fontWeight: '600' },
  rolePressed: { opacity: 0.72 },
  roleGo: { fontSize: font.xs, fontWeight: '800', marginTop: 'auto', paddingTop: 8 },




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
