import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSummary, ProfileGap } from '@workflex/shared';
import { fetchDashboardSummary } from '../../api/auth';
import { fetchNotifications } from '../../api/notifications';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * The panels that make up the dashboard body.
 *
 * Every figure shown here is read from a real row. The reference design also
 * carried a wallet balance, an average rating, an on-time percentage and a
 * shelf of achievements; none of those exist in this product yet, and putting
 * invented numbers on the first screen someone sees would make the whole
 * dashboard untrustworthy the moment one of them was noticed. They are left
 * out rather than mocked, and the sections that are real are given the room.
 */

const GAP_LABELS: Record<ProfileGap, TranslationKey> = {
  NAME: 'dash.gap.NAME',
  NID_VERIFIED: 'dash.gap.NID_VERIFIED',
  PHOTO: 'dash.gap.PHOTO',
  CV: 'dash.gap.CV',
  EMAIL: 'dash.gap.EMAIL',
};

/** Where each gap is actually fixed, so the prompt is one tap from the cure. */
const GAP_ROUTES: Record<ProfileGap, string> = {
  NAME: '/(app)/profile',
  NID_VERIFIED: '/(onboarding)/documents',
  PHOTO: '/(onboarding)/documents',
  CV: '/(app)/cv',
  EMAIL: '/(app)/profile',
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  });
}

/**
 * A greeting that changes with the hour.
 *
 * Resolved on the device rather than the server: this is the one thing on the
 * screen that should follow the reader's own clock, and a server in another
 * timezone wishing someone good morning at nine at night is worse than no
 * greeting at all.
 */
export function Greeting({ name }: { name: string }) {
  const t = useT();
  const { c } = useTheme();

  const hour = new Date().getHours();
  const key: TranslationKey =
    hour < 12 ? 'dash.morning' : hour < 17 ? 'dash.afternoon' : 'dash.evening';

  return (
    <View style={styles.greeting}>
      <Text style={[styles.greetingTitle, { color: c.text }]}>
        {t(key, { name })} 👋
      </Text>
      <Text style={[styles.greetingBody, { color: c.textMuted }]}>
        {t('dash.greetingBody')}
      </Text>
    </View>
  );
}

/**
 * How complete the profile is, and the next thing to do about it.
 *
 * The bar is the point, not the number: a percentage on its own tells someone
 * they are incomplete without telling them what to do, which is a nag. The
 * first missing item is named and links straight to the screen that fixes it.
 */
export function ProfileStrength({ data }: { data: DashboardSummary }) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { percent, missing } = data.profileStrength;
  const next = missing[0];

  const tone =
    percent >= 80 ? c.success : percent >= 50 ? c.warning : c.danger;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.strengthHead}>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {t('dash.strength')}
        </Text>
        <Text style={[styles.strengthPercent, { color: tone }]}>{percent}%</Text>
      </View>

      <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
        <View
          style={[styles.fill, { width: `${percent}%`, backgroundColor: tone }]}
        />
      </View>

      {next ? (
        <Pressable
          onPress={() => router.push(GAP_ROUTES[next] as never)}
          accessibilityRole="button"
          style={styles.strengthCta}
        >
          <Text style={[styles.strengthNext, { color: c.textMuted }]}>
            {t('dash.nextStep')}{' '}
            <Text style={{ color: c.primary, fontWeight: '800' }}>
              {t(GAP_LABELS[next])} →
            </Text>
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.strengthNext, { color: c.success }]}>
          ✓ {t('dash.strengthComplete')}
        </Text>
      )}
    </View>
  );
}

/**
 * The counts, split by what the person is doing rather than by data type.
 *
 * Looking for work and hiring are two different jobs, and mixing "3
 * applications" with "12 applicants" in one row makes both harder to read —
 * the same word means opposite things on either side.
 */
export function ActivityOverview({ data }: { data: DashboardSummary }) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const rows: {
    label: TranslationKey;
    value: number;
    hint?: string;
    href: string;
  }[] = [
    {
      label: 'dash.stat.applications',
      value: data.seeking.applications,
      hint: t('dash.stat.activeOf', { count: data.seeking.activeApplications }),
      href: '/(app)/applications',
    },
    {
      label: 'dash.stat.saved',
      value: data.seeking.savedJobs,
      href: '/(app)/jobs?saved=1',
    },
    {
      label: 'dash.stat.posted',
      value: data.hiring.jobsPosted,
      hint: t('dash.stat.openOf', { count: data.hiring.openJobs }),
      href: '/(app)/my-jobs',
    },
    {
      label: 'dash.stat.applicants',
      value: data.hiring.applicants,
      href: '/(app)/my-jobs',
    },
  ];

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t('dash.activity')}
      </Text>

      <View style={styles.statGrid}>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            onPress={() => router.push(row.href as never)}
            accessibilityRole="button"
            style={[
              styles.stat,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.statValue, { color: c.text }]}>{row.value}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>
              {t(row.label)}
            </Text>
            {row.hint ? (
              <Text style={[styles.statHint, { color: c.primary }]}>
                {row.hint}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * The three most recent announcements.
 *
 * A preview, not the list: the bell already opens the full screen, and a
 * dashboard that reproduces another page in full has stopped being a summary.
 */
export function RecentNotifications() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 60_000,
  });

  const items = data?.items.slice(0, 3) ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          {t('dash.notifications')}
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.viewAll, { color: c.primary }]}>
            {t('dash.viewAll')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {items.map((n, i) => (
          <View
            key={n.id}
            style={[
              styles.notice,
              i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
            ]}
          >
            <View style={styles.noticeTop}>
              <Text
                style={[styles.noticeTitle, { color: c.text }]}
                numberOfLines={1}
              >
                {n.title}
              </Text>
              {!n.read ? (
                <View style={[styles.dot, { backgroundColor: c.primary }]} />
              ) : null}
            </View>
            <Text
              style={[styles.noticeBody, { color: c.textMuted }]}
              numberOfLines={2}
            >
              {n.body}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },
  viewAll: { fontSize: font.sm, fontWeight: '800' },

  greeting: { marginTop: space.sm },
  greetingTitle: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.5 },
  greetingBody: { fontSize: font.sm, marginTop: 4 },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginTop: space.md },
  cardTitle: { fontSize: font.md, fontWeight: '800' },

  strengthHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strengthPercent: { fontSize: font.lg, fontWeight: '800' },
  track: { height: 8, borderRadius: radius.pill, marginTop: 10, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  strengthCta: { marginTop: 10 },
  strengthNext: { fontSize: font.sm, marginTop: 10, lineHeight: 19 },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: space.md,
  },
  stat: {
    // Two per row on a phone, without hard-coding a pixel width.
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
  },
  statValue: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: font.xs, marginTop: 2, fontWeight: '600' },
  statHint: { fontSize: font.xs, marginTop: 6, fontWeight: '700' },

  notice: { paddingVertical: 12 },
  noticeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeTitle: { flex: 1, fontSize: font.sm, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  noticeBody: { fontSize: font.xs, marginTop: 4, lineHeight: 17 },
});
