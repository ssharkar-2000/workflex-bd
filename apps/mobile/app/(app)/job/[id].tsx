import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jobCategoryName,
  type JobListing,
  type PaymentType,
} from '@workflex/shared';
import { fetchJob, toggleSavedJob } from '../../../src/api/jobs';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { MatchBadge } from '../../../src/components/jobs/MatchBadge';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type Tab = 'overview' | 'requirements' | 'benefits';

const REASON_KEYS: Record<'skills' | 'experience' | 'category', TranslationKey> = {
  skills: 'match.axis.skills',
  experience: 'match.axis.experience',
  category: 'match.axis.category',
};

const JOB_TYPE_KEYS: Record<JobListing['jobType'], TranslationKey> = {
  FULL_TIME: 'jobs.type.FULL_TIME',
  PART_TIME: 'jobs.type.PART_TIME',
  PERMANENT: 'jobs.type.PERMANENT',
  CONTRACT: 'jobs.type.CONTRACT',
  FREELANCE: 'jobs.type.FREELANCE',
  INTERNSHIP: 'jobs.type.INTERNSHIP',
  TEMPORARY: 'jobs.type.TEMPORARY',
  SEASONAL: 'jobs.type.SEASONAL',
  SHIFT_BASED: 'jobs.type.SHIFT_BASED',
  ONE_TIME: 'jobs.type.ONE_TIME',
};

const WORKPLACE_KEYS: Record<JobListing['workplaceType'], TranslationKey> = {
  ONSITE: 'jobs.place.ONSITE',
  REMOTE: 'jobs.place.REMOTE',
  HYBRID: 'jobs.place.HYBRID',
};

const EXPERIENCE_KEYS: Record<JobListing['experienceLevel'], TranslationKey> = {
  ENTRY: 'jobs.exp.ENTRY',
  ONE_TO_THREE: 'jobs.exp.ONE_TO_THREE',
  THREE_TO_FIVE: 'jobs.exp.THREE_TO_FIVE',
  FIVE_PLUS: 'jobs.exp.FIVE_PLUS',
};

const DURATION_KEYS: Record<JobListing['duration'], TranslationKey> = {
  ONE_TIME: 'jobs.dur.ONE_TIME',
  ONE_DAY: 'jobs.dur.ONE_DAY',
  FEW_DAYS: 'jobs.dur.FEW_DAYS',
  ONE_WEEK: 'jobs.dur.ONE_WEEK',
  ONE_MONTH: 'jobs.dur.ONE_MONTH',
  THREE_TO_SIX_MONTHS: 'jobs.dur.THREE_TO_SIX_MONTHS',
  LONG_TERM: 'jobs.dur.LONG_TERM',
};

const PAYMENT_KEYS: Record<PaymentType, TranslationKey> = {
  HOURLY: 'jobs.pay.HOURLY',
  DAILY: 'jobs.pay.DAILY',
  WEEKLY: 'jobs.pay.WEEKLY',
  MONTHLY: 'jobs.pay.MONTHLY',
  FIXED_PROJECT: 'jobs.pay.FIXED_PROJECT',
  NEGOTIABLE: 'jobs.pay.NEGOTIABLE',
};

const WORKING_TIME_KEYS: Record<JobListing['workingTime'], TranslationKey> = {
  MORNING: 'jobs.time.MORNING',
  AFTERNOON: 'jobs.time.AFTERNOON',
  EVENING: 'jobs.time.EVENING',
  NIGHT: 'jobs.time.NIGHT',
  FLEXIBLE: 'jobs.time.FLEXIBLE',
};

const URGENCY_KEYS: Record<JobListing['urgency'], TranslationKey> = {
  IMMEDIATE: 'jobs.urg.IMMEDIATE',
  WITHIN_24H: 'jobs.urg.WITHIN_24H',
  WITHIN_3_DAYS: 'jobs.urg.WITHIN_3_DAYS',
  THIS_WEEK: 'jobs.urg.THIS_WEEK',
  NONE: 'jobs.urg.NONE',
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const [tab, setTab] = useState<Tab>('overview');

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => fetchJob(id),
    enabled: Boolean(id),
  });

  const save = useMutation({
    mutationFn: () => toggleSavedJob(id),
    onSuccess: () => {
      // Both the detail and any list holding this card show the bookmark.
      void queryClient.invalidateQueries({ queryKey: ['job', id] });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const onShare = () => {
    if (!job) return;
    void Share.share({
      message: `${job.title} — ${job.companyName}, ${job.location}\n${t('jobs.shareVia')}`,
    }).catch(() => undefined);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <Header onBack={() => router.back()} onShare={undefined} />
        <View style={styles.pad}>
          <ErrorBanner message={errorMessage(error)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header onBack={() => router.back()} onShare={onShare} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Company */}
        <View style={styles.companyRow}>
          <View
            style={[
              styles.logo,
              { backgroundColor: c.tints[0], borderColor: c.tintBorders[0] },
            ]}
          >
            <Text style={[styles.logoText, { color: c.text }]}>
              {job.companyInitials}
            </Text>
          </View>
          <View style={styles.companyText}>
            <Text style={[styles.company, { color: c.text }]} numberOfLines={1}>
              {job.companyName}
            </Text>
            {/* The sector, not a company profile — there is no company record
                behind most postings in this market. */}
            <Text style={[styles.sector, { color: c.textMuted }]} numberOfLines={1}>
              {jobCategoryName(job.category, locale)}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: c.text }]}>{job.title}</Text>

        {/* Facts that decide whether the job is worth reading further. */}
        <View style={styles.pills}>
          <Pill icon="📍" text={job.location} />
          <Pill icon="🕐" text={t(JOB_TYPE_KEYS[job.jobType])} />
          <Pill icon="🏢" text={t(WORKPLACE_KEYS[job.workplaceType])} />
          <Pill icon="📅" text={t('jobs.postedOn', { date: date(job.postedAt) })} />
        </View>

        {/* Fit before urgency: whether the job suits you decides whether its
            deadline is even relevant. */}
        {job.match ? (
          <View
            style={[
              styles.matchCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={styles.matchHead}>
              <MatchBadge match={job.match} showScore />
              <Text style={[styles.matchTitle, { color: c.textMuted }]}>
                {t('match.basedOnCv')}
              </Text>
            </View>

            {job.match.matchedSkills.length > 0 ? (
              <Text style={[styles.matchWhy, { color: c.text }]}>
                {t('match.because', {
                  skills: job.match.matchedSkills.join(', '),
                })}
              </Text>
            ) : (
              <Text style={[styles.matchWhy, { color: c.textMuted }]}>
                {t('match.noOverlap')}
              </Text>
            )}

            {/* The breakdown is what makes the number arguable rather than
                mysterious — someone can see which axis let them down. */}
            <View style={styles.bars}>
              {job.match.reasons.map((r) => (
                <View key={r.key} style={styles.bar}>
                  <Text style={[styles.barLabel, { color: c.textMuted }]}>
                    {t(REASON_KEYS[r.key])}
                  </Text>
                  <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          backgroundColor: c.primary,
                          width: `${Math.round((r.earned / r.possible) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {job.urgency !== 'NONE' ? (
          <View
            style={[
              styles.urgent,
              { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
            ]}
          >
            <Text style={[styles.urgentText, { color: c.danger }]}>
              🔥 {t('jobs.urgentHiring')} · {t(URGENCY_KEYS[job.urgency])}
            </Text>
          </View>
        ) : null}

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: c.border }]}>
          <TabButton
            label={t('job.tab.overview')}
            on={tab === 'overview'}
            onPress={() => setTab('overview')}
          />
          <TabButton
            label={t('job.tab.requirements')}
            on={tab === 'requirements'}
            onPress={() => setTab('requirements')}
          />
          <TabButton
            label={t('job.tab.benefits')}
            on={tab === 'benefits'}
            onPress={() => setTab('benefits')}
          />
        </View>

        {tab === 'overview' ? (
          <>
            <Section title={t('job.tab.overview')}>
              <View style={styles.grid}>
                <Fact
                  icon="👤"
                  label={t('job.experience')}
                  value={t(EXPERIENCE_KEYS[job.experienceLevel])}
                />
                <Fact
                  icon="💳"
                  label={t(PAYMENT_KEYS[job.paymentType])}
                  value={payLabel(job)}
                />
                <Fact
                  icon="⏱"
                  label={t('job.applyBy')}
                  value={job.deadline ? date(job.deadline) : t('job.noDeadline')}
                />
                <Fact
                  icon="👥"
                  label={t('job.vacancies')}
                  value={
                    job.vacancies !== null
                      ? String(job.vacancies)
                      : t('job.notSpecified')
                  }
                />
                <Fact
                  icon="📅"
                  label={t('filter.duration')}
                  value={t(DURATION_KEYS[job.duration])}
                />
                <Fact
                  icon="🕒"
                  label={t('filter.workingTime')}
                  value={t(WORKING_TIME_KEYS[job.workingTime])}
                />
                <Fact
                  icon="🚀"
                  label={t('job.startDate')}
                  value={
                    job.startDate
                      ? date(job.startDate)
                      : t('jobs.start.FLEXIBLE')
                  }
                />
                <Fact
                  icon="🗂"
                  label={t('filter.category')}
                  value={jobCategoryName(job.category, locale)}
                />
              </View>
            </Section>

            <Section title={t('job.description')}>
              <Body text={job.description} />
            </Section>
          </>
        ) : null}

        {tab === 'requirements' ? (
          <Section title={t('job.tab.requirements')}>
            <Body text={job.requirements} empty={t('job.noRequirements')} />
          </Section>
        ) : null}

        {tab === 'benefits' ? (
          <Section title={t('job.tab.benefits')}>
            <Body text={job.benefits} empty={t('job.noBenefits')} />
          </Section>
        ) : null}

        {/* Reporting carries the posting with it, so nobody has to describe
            which listing they mean. */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(app)/report',
              params: { jobId: job.id, jobTitle: job.title },
            })
          }
          style={styles.reportRow}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.reportText, { color: c.danger }]}>
            🚩 {t('job.report')}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Save is the only action that exists — applying needs an applications
          module, and a button that does nothing is worse than no button. */}
      <View style={[styles.foot, { borderTopColor: c.border, backgroundColor: c.bg }]}>
        <ShimmerButton
          label={job.saved ? t('jobs.unsave') : t('jobs.save')}
          onPress={() => save.mutate()}
          loading={save.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  onShare,
}: {
  onBack: () => void;
  onShare?: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
        <Text style={[styles.back, { color: c.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: c.text }]}>
        {t('job.title')}
      </Text>
      {onShare ? (
        <Pressable
          onPress={onShare}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('job.share')}
        >
          <Text style={[styles.share, { color: c.text }]}>↗</Text>
        </Pressable>
      ) : (
        <View style={styles.shareSpacer} />
      )}
    </View>
  );
}

/** Formats the pay bounds with their cadence — "৳500 – ৳900" alone is ambiguous. */
function payLabel(job: JobListing): string {
  const money = (n: number) => n.toLocaleString('en-US');
  if (job.salaryMin !== null && job.salaryMax !== null) {
    return `৳${money(job.salaryMin)} – ৳${money(job.salaryMax)}`;
  }
  if (job.salaryMin !== null) return `৳${money(job.salaryMin)}+`;
  if (job.salaryMax !== null) return `≤ ৳${money(job.salaryMax)}`;
  return '—';
}

function TabButton({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={[styles.tab, on && { borderBottomColor: c.primary }]}
    >
      <Text
        style={[
          styles.tabText,
          { color: on ? c.text : c.textMuted, fontWeight: on ? '800' : '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.fact, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.factHead}>
        <Text style={styles.factIcon}>{icon}</Text>
        <Text style={[styles.factLabel, { color: c.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.factValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function Body({ text, empty }: { text: string | null; empty?: string }) {
  const { c } = useTheme();
  if (!text) {
    return (
      <Text style={[styles.body, { color: c.textMuted }]}>
        {empty ?? '—'}
      </Text>
    );
  }
  return <Text style={[styles.body, { color: c.text }]}>{text}</Text>;
}

function Pill({ icon, text }: { icon: string; text: string }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.pill, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={[styles.pillText, { color: c.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: space.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  back: { fontSize: 22, fontWeight: '700' },
  headerTitle: { fontSize: font.md, fontWeight: '800' },
  share: { fontSize: 20, fontWeight: '700' },
  shareSpacer: { width: 20 },

  scroll: { paddingHorizontal: space.md, paddingBottom: space.xl },

  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: font.sm, fontWeight: '800' },
  companyText: { flex: 1 },
  company: { fontSize: font.md, fontWeight: '700' },
  sector: { fontSize: font.sm, marginTop: 1 },

  title: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 14,
    lineHeight: 32,
  },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  pillIcon: { fontSize: 11 },
  pillText: { fontSize: font.xs, fontWeight: '600', maxWidth: 190 },

  matchCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 14,
  },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchTitle: { flex: 1, fontSize: font.xs },
  matchWhy: { fontSize: font.sm, lineHeight: 20, marginTop: 10 },
  bars: { gap: 8, marginTop: 12 },
  bar: { gap: 4 },
  barLabel: { fontSize: font.xs - 1, fontWeight: '700' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },

  urgent: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 12,
  },
  urgentText: { fontSize: font.xs, fontWeight: '800' },

  tabs: { flexDirection: 'row', gap: 18, borderBottomWidth: 1, marginTop: 18 },
  tab: { paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: font.sm },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: font.md, fontWeight: '800', marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: {
    // Two per row on a phone, with the gap taken out of the width.
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factIcon: { fontSize: 12 },
  factLabel: { flex: 1, fontSize: font.xs, fontWeight: '600' },
  factValue: { fontSize: font.sm, fontWeight: '800', marginTop: 6 },

  body: { fontSize: font.sm, lineHeight: 22 },

  reportRow: { alignItems: 'center', marginTop: space.lg, padding: 8 },
  reportText: { fontSize: font.sm, fontWeight: '700' },

  foot: { padding: space.md, borderTopWidth: 1 },
});
