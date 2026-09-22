import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSummary, ProfileGap } from '@workflex/shared';
import { fetchDashboardSummary } from '../../api/auth';
import { Avatar } from '../Avatar';
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
 * The profile control's geometry: the avatar inside the strength ring, with a
 * small gap so the ring reads as a frame round the picture rather than as its
 * border.
 *
 * The ring was a full-width card once, which spent a whole band of the
 * dashboard on one number; then a badge of its own beside the bell. Around
 * the avatar it is glanceable in the place people already look for their own
 * status, and it no longer takes a slot of its own.
 */
const AVATAR_SIZE = 34;
const RING_STROKE = 3;
const RING_GAP = 2;
const RING_SIZE = AVATAR_SIZE + 2 * (RING_GAP + RING_STROKE);
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
 * The account's avatar framed by its profile-strength ring — one control
 * where the header used to have two.
 *
 * The ring sat beside the bell and the avatar beside that, saying two halves
 * of one thing: who you are here, and how much of it the app can vouch for.
 * Merged by request, the ring now wraps the picture and its figure rides on
 * the ring's foot as a small badge, so the number is still there to read.
 *
 * Tapping opens My Profile, as tapping your own picture does everywhere; the
 * verification card there leads on to what is still missing. Ring and badge
 * drop away once nothing is missing — a ring permanently at 100% is
 * decoration — leaving the plain avatar in the same footprint, so the header
 * does not shift when the profile is finished.
 *
 * Fetches its own summary rather than taking a prop: it lives in the header,
 * which renders before the dashboard body has any data, and threading the
 * value down through Header would couple the two for no gain. The query is
 * shared by key, so this costs no extra request.
 */
export function ProfileAvatar({
  hasPhoto,
  initials,
  version,
  label,
}: {
  hasPhoto: boolean;
  initials: string;
  /** Changes when the photo does; see Avatar. */
  version?: string;
  /** What a screen reader calls the control, before the strength details. */
  label: string;
}) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const { data } = useDashboardSummary();

  const strength = data?.profileStrength;
  const next = strength?.missing[0];
  const percent = strength?.percent ?? 0;
  const band =
    STRENGTH_BANDS.find((b) => percent >= b.min) ?? STRENGTH_BANDS.at(-1)!;

  // Drawn from the top and clockwise: an arc that starts at three o'clock
  // reads as an arbitrary slice rather than as progress.
  const filled = RING_CIRCUMFERENCE * (percent / 100);

  return (
    <Pressable
      onPress={() => router.push('/(app)/profile')}
      hitSlop={6}
      accessibilityRole="button"
      // A screen reader cannot see the ring, so it hears what the ring says:
      // "My profile. Profile strength, good, 50%. Next: verify your NID."
      accessibilityLabel={
        next
          ? `${label}. ${t('dash.strength')}, ${t(band.label)}, ${percent}%. ${t(
              'dash.nextStep',
            )} ${t(GAP_LABELS[next])}`
          : label
      }
      style={styles.profile}
    >
      {next ? (
        <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
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
      ) : null}

      <Avatar
        hasPhoto={hasPhoto}
        initials={initials}
        size={AVATAR_SIZE}
        version={version}
      />

      {/* The figure on the ring's foot, cut out of the ring by a rim in the
          page colour. A plain View over the SVG rather than SVG text:
          react-native-svg's <Text> does not inherit the app's font. */}
      {next ? (
        <View
          style={[styles.percentBadge, { backgroundColor: c.primary, borderColor: c.bg }]}
          pointerEvents="none"
        >
          <Text style={[styles.percentText, { color: c.primaryText }]}>{percent}%</Text>
        </View>
      ) : null}
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

  profile: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    minWidth: 28,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  percentText: { fontSize: 9, fontWeight: '800', letterSpacing: -0.1 },

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
