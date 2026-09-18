import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { jobCategoryName, type MyJob } from '@workflex/shared';
import { fetchMyJobs } from '../../api/jobs';
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';
import { useDashboardSummary } from './DashboardSections';

/**
 * How many postings the dashboard shows before deferring to the full list.
 *
 * Three. The dashboard is a summary of what needs attention, and a poster with
 * eleven live jobs wants the three that need deciding today, not a scrolling
 * duplicate of the Activity screen.
 */
const SHOWN = 3;

/**
 * The hiring half of the dashboard.
 *
 * One account is both a job seeker and a recruiter here — that is the product's
 * whole shape — but a dashboard made of recommended jobs and applications
 * reads as a job board that happens to let you post, and someone who never
 * scrolls to the workspace grid would never learn they can hire at all.
 *
 * So this section renders even with nothing in it. The empty state is not a
 * placeholder waiting for data: for an account that has only ever looked for
 * work, it is the one place on the screen that says hiring is also theirs to
 * do, and hiding it would keep that hidden from exactly the people who do not
 * know it yet.
 */
export function MyHiringActivity() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { data: summary } = useDashboardSummary();
  const { data } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: fetchMyJobs,
    staleTime: 60_000,
  });

  if (!data) return null;

  /**
   * Open postings first, then whoever has people waiting longest unattended.
   *
   * Newest-first is the wrong order for this card. A poster's attention should
   * go to the job with ten unread applicants, not the one they happened to
   * publish this morning, and a closed posting needs nothing from anyone.
   */
  const jobs = [...data.jobs]
    .sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      return b.applicantCount - a.applicantCount;
    })
    .slice(0, SHOWN);

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>
          📢 {t('hiring.title')}
        </Text>
        {data.jobs.length > 0 ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/activity',
                params: { tab: 'jobs' },
              })
            }
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={[styles.seeAll, { color: c.primary }]}>
              {t('jobs.seeAll')} →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {summary && data.jobs.length > 0 ? (
        <View style={styles.totals}>
          <Total
            label="hiring.total.active"
            value={summary.hiring.openJobs}
            tint={0}
          />
          <Total
            label="hiring.total.applicants"
            value={summary.hiring.applicants}
            tint={1}
          />
          <Total
            label="hiring.total.shortlisted"
            value={summary.hiring.shortlisted}
            tint={2}
          />
        </View>
      ) : null}

      {jobs.length > 0 ? (
        <View style={styles.list}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.empty,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            {t('hiring.emptyTitle')}
          </Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>
            {t('hiring.emptyBody')}
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/post-job')}
            accessibilityRole="button"
            style={[styles.emptyCta, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.emptyCtaText, { color: c.primaryText }]}>
              {t('hiring.post')} →
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Total({
  label,
  value,
  tint,
}: {
  label: TranslationKey;
  value: number;
  tint: number;
}) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View
      style={[
        styles.total,
        {
          backgroundColor: c.tints[tint % c.tints.length],
          borderColor: c.tintBorders[tint % c.tintBorders.length],
        },
      ]}
    >
      <Text style={[styles.totalValue, { color: c.text }]}>{value}</Text>
      <Text
        style={[styles.totalLabel, { color: c.textMuted }]}
        numberOfLines={2}
      >
        {t(label)}
      </Text>
    </View>
  );
}

function JobCard({ job }: { job: MyJob }) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const [locale] = useLocale();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
        {job.title}
      </Text>
      <Text style={[styles.cardMeta, { color: c.textMuted }]} numberOfLines={1}>
        {jobCategoryName(job.category, locale)} · {job.location}
      </Text>

      <View style={styles.stats}>
        <Text
          style={[
            styles.status,
            { color: job.isOpen ? c.success : c.textMuted },
          ]}
        >
          {job.isOpen ? '🟢' : '⚪'}{' '}
          {t(job.isOpen ? 'myJobs.live' : 'myJobs.closed')}
        </Text>
        {/* Muted at zero: "0 applicants" is not news worth colouring, and a
            poster reading a wall of highlighted zeros learns nothing. */}
        <Text
          style={[
            styles.stat,
            { color: job.applicantCount > 0 ? c.text : c.textMuted },
          ]}
        >
          {t('hiring.applicants', { count: job.applicantCount })}
        </Text>
        <Text
          style={[
            styles.stat,
            { color: job.shortlistedCount > 0 ? c.primary : c.textMuted },
          ]}
        >
          {t('hiring.shortlisted', { count: job.shortlistedCount })}
        </Text>
      </View>

      <Pressable
        onPress={() =>
          router.push({ pathname: '/(app)/job/[id]', params: { id: job.id } })
        }
        accessibilityRole="button"
        accessibilityLabel={`${t('hiring.manage')} — ${job.title}`}
        style={[styles.manage, { borderColor: c.border }]}
      >
        <Text style={[styles.manageText, { color: c.primary }]}>
          {t('hiring.manage')} →
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700' },
  seeAll: { fontSize: font.sm, fontWeight: '800' },

  totals: { flexDirection: 'row', gap: 8, marginTop: space.md },
  total: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  totalValue: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.5 },
  totalLabel: {
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },

  list: { marginTop: space.md, gap: 10 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  cardTitle: { fontSize: font.sm, fontWeight: '800' },
  cardMeta: { fontSize: font.xs, marginTop: 2 },

  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  status: { fontSize: font.xs, fontWeight: '800' },
  stat: { fontSize: font.xs, fontWeight: '700' },

  manage: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 10,
  },
  manageText: { fontSize: font.xs, fontWeight: '800' },

  empty: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  emptyTitle: { fontSize: font.sm, fontWeight: '800' },
  emptyBody: { fontSize: font.xs, marginTop: 4, lineHeight: 18 },
  emptyCta: {
    alignSelf: 'flex-start',
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  emptyCtaText: { fontSize: font.xs, fontWeight: '800' },
});
