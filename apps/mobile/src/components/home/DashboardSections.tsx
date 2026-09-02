import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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

/** The ring's geometry. Kept together so the maths below reads in one place. */
const RING_SIZE = 68;
const RING_STROKE = 7;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Words for the score, so the number is not the only thing said. */
const STRENGTH_BANDS: { min: number; label: TranslationKey }[] = [
  { min: 90, label: 'dash.band.excellent' },
  { min: 70, label: 'dash.band.veryGood' },
  { min: 50, label: 'dash.band.good' },
  { min: 25, label: 'dash.band.fair' },
  { min: 0, label: 'dash.band.needsWork' },
];

/**
 * How complete the profile is, as a ring with the figure inside it.
 *
 * A ring rather than a bar because the number is the subject here, not the
 * progress: it sits in the middle at full size and is legible at a glance,
 * where a bar makes the reader infer the value from a length. The qualitative
 * word underneath does the work a percentage cannot — "86%" of what is not
 * obvious, "Very Good" is.
 *
 * `Improve profile` routes to whichever gap is outstanding rather than to a
 * generic settings page, so the prompt is one tap from its own cure.
 */
export function ProfileStrength({ data }: { data: DashboardSummary }) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { percent, missing } = data.profileStrength;
  const next = missing[0];
  const band =
    STRENGTH_BANDS.find((b) => percent >= b.min) ?? STRENGTH_BANDS.at(-1)!;

  // Drawn from the top and clockwise: an arc that starts at three o'clock
  // reads as an arbitrary slice rather than as progress.
  const filled = RING_CIRCUMFERENCE * (percent / 100);

  return (
    <View
      style={[
        styles.card,
        styles.strengthCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.strengthText}>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {t('dash.strength')}
        </Text>
        <Text style={[styles.strengthBand, { color: c.textMuted }]}>
          {t(band.label)}
        </Text>

        {next ? (
          <Pressable
            onPress={() => router.push(GAP_ROUTES[next] as never)}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.strengthCta}
          >
            <Text style={[styles.strengthLink, { color: c.primary }]}>
              {t('dash.improve')} →
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.strengthLink, { color: c.success }]}>
            ✓ {t('dash.strengthComplete')}
          </Text>
        )}
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* The unfilled remainder, so the ring reads as a whole. */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={c.surfaceAlt}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={c.primary}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${RING_CIRCUMFERENCE}`}
            // SVG arcs begin at three o'clock; this brings the start to noon.
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>

        {/* Absolutely positioned over the SVG rather than nested inside it:
            react-native-svg's own <Text> does not inherit the app's font. */}
        <View style={styles.ringLabel} pointerEvents="none">
          <Text style={[styles.ringPercent, { color: c.text }]}>{percent}%</Text>
        </View>
      </View>
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

  strengthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  strengthText: { flex: 1, gap: 2 },
  strengthBand: { fontSize: font.sm, fontWeight: '600' },
  strengthCta: { marginTop: 6, alignSelf: 'flex-start' },
  strengthLink: { fontSize: font.sm, fontWeight: '800', marginTop: 6 },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: { fontSize: font.md, fontWeight: '800', letterSpacing: -0.4 },

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
