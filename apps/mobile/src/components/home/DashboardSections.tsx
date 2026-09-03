import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSummary, ProfileGap } from '@workflex/shared';
import { fetchDashboardSummary } from '../../api/auth';
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
 * A greeting that changes with the hour, sized for the header row.
 *
 * Resolved on the device rather than the server: this is the one thing on the
 * screen that should follow the reader's own clock, and a server in another
 * timezone wishing someone good morning at nine at night is worse than no
 * greeting at all.
 *
 * It sits beside the avatar where the old static welcome was, so both lines
 * are clipped to one line each and the block takes the space left between the
 * avatar and the controls. A long name shortens the line rather than pushing
 * the ring and bell off the edge.
 */
export function Greeting({ name }: { name: string }) {
  const t = useT();
  const { c } = useTheme();

  const hour = new Date().getHours();
  const key: TranslationKey =
    hour < 12 ? 'dash.morning' : hour < 17 ? 'dash.afternoon' : 'dash.evening';

  return (
    <View style={styles.greeting}>
      <Text
        style={[styles.greetingTitle, { color: c.text }]}
        numberOfLines={1}
      >
        {t(key, { name })} 👋
      </Text>
      <Text style={[styles.greetingBody, { color: c.textMuted }]}>
        {t('dash.greetingBody')}
      </Text>
    </View>
  );
}

/**
 * The ring's geometry, sized to sit in the header beside the bell.
 *
 * It was a full-width card, which spent a whole band of the dashboard on one
 * number. As a header badge it is glanceable in the place people already look
 * for status, and the body is left for things that need the room.
 */
const RING_SIZE = 34;
const RING_STROKE = 3.5;
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
 * Profile completeness as a header badge, beside the notification bell.
 *
 * Fetches its own summary rather than taking a prop: it lives in the header,
 * which renders before the dashboard body has any data, and threading the
 * value down through Header would couple the two for no gain. The query is
 * shared by key, so this costs no extra request.
 *
 * Renders nothing at all once the profile is complete. A ring permanently at
 * 100% is decoration — the badge exists to prompt the work that is left, and
 * when there is none it should stop taking up space.
 */
export function ProfileStrengthBadge() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const { data } = useDashboardSummary();

  if (!data) return null;

  const { percent, missing } = data.profileStrength;
  const next = missing[0];
  if (!next) return null;

  const band =
    STRENGTH_BANDS.find((b) => percent >= b.min) ?? STRENGTH_BANDS.at(-1)!;

  // Drawn from the top and clockwise: an arc that starts at three o'clock
  // reads as an arbitrary slice rather than as progress.
  const filled = RING_CIRCUMFERENCE * (percent / 100);

  return (
    <Pressable
      onPress={() => router.push(GAP_ROUTES[next] as never)}
      hitSlop={8}
      accessibilityRole="progressbar"
      // The whole label goes to a screen reader, which cannot see the ring:
      // "Profile strength, very good, 50 percent. Next: verify your NID."
      accessibilityLabel={`${t('dash.strength')}, ${t(band.label)}, ${percent}%. ${t(
        'dash.nextStep',
      )} ${t(GAP_LABELS[next])}`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.badge}
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
        <Text style={[styles.ringPercent, { color: c.text }]}>{percent}</Text>
      </View>
    </Pressable>
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

  /**
   * The second line is the interesting half, so it is chosen rather than
   * fixed: how many of your applications reached a shortlist says more than
   * how many are merely still open, and only falls back to the opener when
   * nothing has been shortlisted yet. Each phrasing names its own unit, so a
   * tile never leaves the reader guessing which number they are looking at.
   *
   * A hint of zero is dropped entirely. "0 shortlisted" under a 0 is the same
   * fact written twice, and in a tile this narrow the space is worth more than
   * the repetition.
   */
  const rows: {
    icon: string;
    label: TranslationKey;
    value: number;
    hint?: string;
    href: string;
  }[] = [
    {
      icon: '📄',
      label: 'dash.stat.applications',
      value: data.seeking.applications,
      hint:
        data.seeking.shortlisted > 0
          ? t('dash.stat.shortlistedOf', { count: data.seeking.shortlisted })
          : data.seeking.activeApplications > 0
            ? t('dash.stat.activeOf', { count: data.seeking.activeApplications })
            : undefined,
      href: '/(app)/activity',
    },
    {
      icon: '🔖',
      label: 'dash.stat.saved',
      value: data.seeking.savedJobs,
      href: '/(app)/jobs?saved=1',
    },
    {
      icon: '📋',
      label: 'dash.stat.posted',
      value: data.hiring.jobsPosted,
      hint:
        data.hiring.openJobs > 0
          ? t('dash.stat.openOf', { count: data.hiring.openJobs })
          : undefined,
      href: '/(app)/activity?tab=jobs',
    },
    {
      icon: '👥',
      label: 'dash.stat.applicants',
      value: data.hiring.applicants,
      hint:
        data.hiring.shortlisted > 0
          ? t('dash.stat.shortlistedOf', { count: data.hiring.shortlisted })
          : undefined,
      href: '/(app)/activity?tab=jobs',
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
            <Text style={styles.statIcon}>{row.icon}</Text>
            <Text style={[styles.statValue, { color: c.text }]}>{row.value}</Text>
            <Text
              style={[styles.statLabel, { color: c.textMuted }]}
              numberOfLines={2}
            >
              {t(row.label)}
            </Text>
            {row.hint ? (
              <Text
                style={[styles.statHint, { color: c.primary }]}
                numberOfLines={2}
              >
                {row.hint}
              </Text>
            ) : null}
          </Pressable>
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

  greeting: {},
  greetingTitle: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },
  greetingBody: { fontSize: font.sm, marginTop: 3 },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginTop: space.md },
  cardTitle: { fontSize: font.md, fontWeight: '800' },

  badge: { marginRight: 4 },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: { fontSize: font.xs - 1, fontWeight: '800', letterSpacing: -0.2 },

  statGrid: {
    flexDirection: 'row',
    gap: 7,
    marginTop: space.md,
  },
  stat: {
    /**
     * Four across, one row.
     *
     * `flex: 1` with `minWidth: 0` rather than a percentage basis: the four
     * share whatever is left after the gaps, so the row fits a 320px phone and
     * a tablet without a breakpoint. Without `minWidth: 0` a long label would
     * set the floor and push the fourth tile off the screen — flex items
     * refuse to shrink below their content otherwise.
     *
     * The fixed height is what keeps the four aligned when only some of them
     * have a second line, which is the common case: nothing shortlisted yet,
     * nothing posted yet.
     */
    flex: 1,
    minWidth: 0,
    height: 108,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  statIcon: { fontSize: 13, lineHeight: 16 },
  statValue: {
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  statHint: {
    fontSize: 9,
    lineHeight: 11,
    marginTop: 3,
    fontWeight: '700',
    textAlign: 'center',
  },

  notice: { paddingVertical: 12 },
  noticeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeTitle: { flex: 1, fontSize: font.sm, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  noticeBody: { fontSize: font.xs, marginTop: 4, lineHeight: 17 },
});
