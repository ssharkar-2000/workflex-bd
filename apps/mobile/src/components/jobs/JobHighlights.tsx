import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { JobListing } from '@workflex/shared';
import { fetchJobHighlights } from '../../api/jobs';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * The discovery strip above the filters: what the marketplace currently holds,
 * and the listings most worth acting on now.
 *
 * The reference this follows badges each card "Strong match". Nothing on an
 * account records skills or preferences, so a match score would be invented —
 * and a fabricated one is worse than none, because people act on it. The badge
 * carries hiring urgency instead: real, already stored, and the thing that
 * actually makes a listing worth opening today.
 */

const URGENCY_KEYS: Record<JobListing['urgency'], TranslationKey> = {
  IMMEDIATE: 'jobs.urg.IMMEDIATE',
  WITHIN_24H: 'jobs.urg.WITHIN_24H',
  WITHIN_3_DAYS: 'jobs.urg.WITHIN_3_DAYS',
  THIS_WEEK: 'jobs.urg.THIS_WEEK',
  NONE: 'jobs.urg.NONE',
};

export function JobHighlights({
  onSeeAll,
  onOpenJob,
}: {
  /** Narrows the feed to urgent listings — the same set this section shows. */
  onSeeAll: () => void;
  onOpenJob: (id: string) => void;
}) {
  const t = useT();
  const { c } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'highlights'],
    queryFn: fetchJobHighlights,
    // The counts move as postings are added, not by the second.
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!data) return null;

  const { stats, jobs } = data;

  return (
    <View>
      <View
        style={[
          styles.stats,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Stat value={stats.activeJobs} label={t('jobs.stat.active')} />
        <Divider />
        <Stat value={stats.vacancies} label={t('jobs.stat.vacancies')} />
        <Divider />
        <Stat value={stats.organizations} label={t('jobs.stat.organizations')} />
      </View>

      {jobs.length > 0 ? (
        <>
          <View style={styles.head}>
            <Text style={[styles.headTitle, { color: c.text }]}>
              {t('jobs.bestThisWeek')}
            </Text>
            <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.seeAll, { color: c.primary }]}>
                {t('jobs.seeAll')}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // ScrollView's base style grows and shrinks; without this it
            // competes with the feed below for height and loses.
            style={styles.railScroll}
            contentContainerStyle={styles.rail}
          >
            {jobs.map((job, i) => (
              <HighlightCard
                key={job.id}
                job={job}
                index={i}
                onPress={() => onOpenJob(job.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: c.text }]}>
        {value.toLocaleString('en-US')}
      </Text>
      <Text style={[styles.statLabel, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  const { c } = useTheme();
  return <View style={[styles.statDivider, { backgroundColor: c.border }]} />;
}

function HighlightCard({
  job,
  index,
  onPress,
}: {
  job: JobListing;
  index: number;
  onPress: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  const tint = c.tints[index % c.tints.length];
  const tintBorder = c.tintBorders[index % c.tintBorders.length];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${job.companyName}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.cardPressed,
      ]}
    >
      <View
        style={[styles.logo, { backgroundColor: tint, borderColor: tintBorder }]}
      >
        <Text style={[styles.logoText, { color: c.text }]}>
          {job.companyInitials}
        </Text>
      </View>

      <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
        {job.title}
      </Text>
      <Text style={[styles.company, { color: c.textMuted }]} numberOfLines={1}>
        {job.companyName}
      </Text>

      <View style={styles.foot}>
        <View
          style={[
            styles.badge,
            { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
          ]}
        >
          <Text style={[styles.badgeText, { color: c.danger }]}>
            🔥 {t(URGENCY_KEYS[job.urgency])}
          </Text>
        </View>
        <Text style={[styles.place, { color: c.textMuted }]} numberOfLines={1}>
          {job.district ?? job.location}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: space.lg },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginHorizontal: space.md,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statValue: {
    fontSize: font.lg,
    fontWeight: '800',
    // Digits line up across the three columns rather than jittering.
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontSize: font.xs, marginTop: 2 },
  statDivider: { width: 1, height: 28 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    marginTop: space.md,
    marginBottom: 10,
  },
  headTitle: { fontSize: font.md, fontWeight: '800' },
  seeAll: { fontSize: font.sm, fontWeight: '700' },

  railScroll: { flexGrow: 0, flexShrink: 0 },
  rail: { paddingHorizontal: space.md, gap: 10, paddingBottom: 4 },

  card: {
    width: 210,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 12,
  },
  cardPressed: { opacity: 0.72 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: font.xs, fontWeight: '800' },

  title: { fontSize: font.sm, fontWeight: '800', marginTop: 9, lineHeight: 19 },
  company: { fontSize: font.xs, marginTop: 3 },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9.5, fontWeight: '800' },
  place: { flex: 1, fontSize: font.xs },
});
