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
import { maskPhone, VerificationLevel, type AuthUser } from '@workflex/shared';
import { fetchMe, logout } from '../../src/api/auth';
import { updateLocale } from '../../src/api/email';
import { useErrorMessage } from '../../src/lib/error-message';
import { Avatar } from '../../src/components/Avatar';
import { NotificationBell } from '../../src/components/NotificationBell';
import { DashboardMenu } from '../../src/components/DashboardMenu';
import { useAuthStore } from '../../src/store/auth-store';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
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
        <Header user={data} onSignOut={() => void onSignOut()} />

        <RolePicker />
        <ActionGrid
          unlocked={data.verificationLevel >= VerificationLevel.L1_IDENTITY}
        />
        <MyProfileSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  // Initials beat the last two digits of a phone number as a fallback, but an
  // account that has not registered yet has neither — hence the number.
  const initials = fullName
    ? fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : user.phone.slice(-2);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.push('/(app)/profile')}
        accessibilityRole="button"
        accessibilityLabel={t('profile.title')}
      >
        <Avatar
          hasPhoto={user.hasPhoto}
          initials={initials}
          size={50}
          // Re-fetches when the account's photo state flips, so a selfie
          // taken during verification shows up without a restart.
          version={String(user.hasPhoto)}
        />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={[styles.greeting, { color: c.text }]}>
          {t('home.welcome')}
        </Text>
        <Text style={[styles.phone, { color: c.textMuted }]} numberOfLines={1}>
          {fullName || maskPhone(user.phone)}
        </Text>
      </View>

      <NotificationBell />
      <DashboardMenu user={user} onSignOut={onSignOut} />
    </View>
  );
}

/**
 * The way into everything the account holds about you — the registration
 * details, email, and verification progress all live behind this rather than
 * competing with the workspace tiles for room on the dashboard.
 */
function MyProfileSection() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t('home.myProfile')}
      </Text>
      <Pressable
        onPress={() => router.push('/(app)/profile')}
        style={[
          styles.profileRow,
          { backgroundColor: c.tints[3], borderColor: c.tintBorders[3] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('home.myProfile')}
      >
        <Text style={styles.profileEmoji}>👤</Text>
        <View style={styles.profileText}>
          <Text style={[styles.profileTitle, { color: c.text }]}>
            {t('profile.details')}
          </Text>
          <Text style={[styles.profileBody, { color: c.textMuted }]}>
            {t('home.myProfileBody')}
          </Text>
        </View>
        <Text style={[styles.profileChevron, { color: c.textMuted }]}>›</Text>
      </Pressable>
    </View>
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

const ACTIONS = [
  { emoji: '💼', label: 'home.tile.jobs', needsL1: false },
  { emoji: '📄', label: 'home.tile.applications', needsL1: true },
  { emoji: '🗓️', label: 'home.tile.shifts', needsL1: true },
  { emoji: '👛', label: 'home.tile.wallet', needsL1: true },
  { emoji: '⭐', label: 'home.tile.trust', needsL1: true },
  { emoji: '💬', label: 'home.tile.messages', needsL1: false },
] as const satisfies readonly {
  emoji: string;
  label: TranslationKey;
  needsL1: boolean;
}[];

function ActionGrid({ unlocked }: { unlocked: boolean }) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t('home.workspace')}
      </Text>
      <View style={styles.grid}>
        {ACTIONS.map((action, i) => {
          const locked = action.needsL1 && !unlocked;
          return (
            <View
              key={action.label}
              style={[
                styles.tile,
                {
                  // Cycling the tints is what turns this grid from six
                  // identical boxes into the reference's pastel mix. Locked
                  // tiles drop back to the flat page colour, so "unavailable"
                  // stays legible as an absence of colour rather than another
                  // shade competing with the rest.
                  backgroundColor: locked ? c.bg : c.tints[i % c.tints.length],
                  borderColor: locked
                    ? c.border
                    : c.tintBorders[i % c.tintBorders.length],
                },
              ]}
            >
              <Text style={[styles.tileEmoji, locked && styles.tileDim]}>
                {action.emoji}
              </Text>
              <Text
                style={[
                  styles.tileLabel,
                  { color: c.text },
                  locked && styles.tileDim,
                ]}
              >
                {t(action.label)}
              </Text>
              {locked ? (
                <Text style={[styles.tileLock, { color: c.locked }]}>
                  🔒 {t('home.tile.locked')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  container: { padding: space.lg, paddingBottom: space.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  headerText: { flex: 1, flexShrink: 1 },
  greeting: { fontSize: font.lg, fontWeight: '700' },
  phone: { fontSize: font.sm },

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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    width: '30%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  tileEmoji: { fontSize: 24 },
  tileLabel: {
    marginTop: space.xs,
    fontSize: font.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  tileDim: { opacity: 0.45 },
  tileLock: { marginTop: 2, fontSize: font.xs },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
  },
  profileEmoji: { fontSize: 26 },
  profileText: { flex: 1 },
  profileTitle: { fontSize: font.md, fontWeight: '700' },
  profileBody: { fontSize: font.xs, marginTop: 2, lineHeight: 17 },
  profileChevron: { fontSize: font.lg, fontWeight: '700' },

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
