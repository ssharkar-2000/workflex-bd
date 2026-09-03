import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  jobCategoryName,
  type ApplicationStatus,
  type JobApplication,
  type MyJob,
} from '@workflex/shared';
import { fetchMyApplications, fetchMyJobs } from '../../src/api/jobs';
import { useDashboardSummary } from '../../src/components/home/DashboardSections';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useScrollDirectionHandler } from '../../src/lib/scroll-direction';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * Everything this account has in flight, on one screen.
 *
 * Every user here is both a job seeker and a recruiter — that was the point of
 * dropping role selection at signup — so the two sides of that would otherwise
 * need two bottom-bar entries each, and a five-tab bar has no room for four.
 * Tabs inside one destination keep the bar clean and put the two halves a
 * single tap apart, which is right for someone who is doing both at once.
 */

type Tab = 'applications' | 'jobs';

const STATUS_KEYS: Record<ApplicationStatus, TranslationKey> = {
  SUBMITTED: 'app.status.SUBMITTED',
  VIEWED: 'app.status.VIEWED',
  SHORTLISTED: 'app.status.SHORTLISTED',
  ACCEPTED: 'app.status.ACCEPTED',
  REJECTED: 'app.status.REJECTED',
  WITHDRAWN: 'app.status.WITHDRAWN',
};

/**
 * A coloured dot per status, so the list can be scanned without reading.
 *
 * Emoji rather than a tinted view because the colours have to survive both
 * themes unchanged, and a green circle means the same thing in either.
 */
const STATUS_DOTS: Record<ApplicationStatus, string> = {
  SUBMITTED: '🔵',
  VIEWED: '🟡',
  SHORTLISTED: '🟢',
  ACCEPTED: '🟢',
  REJECTED: '⚪',
  WITHDRAWN: '⚪',
};

export default function ActivityScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  // Feeds the floating Post a job button, which slides away while the
  // reader is moving down the page so it stops covering card buttons.
  const onScroll = useScrollDirectionHandler();
  const errorMessage = useErrorMessage();

  // Opened from a stat tile or the menu, which can ask for a specific half.
  const { tab: requested } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(
    requested === 'jobs' ? 'jobs' : 'applications',
  );

  const { data: summary } = useDashboardSummary();

  const applications = useQuery({
    queryKey: ['my-applications'],
    queryFn: fetchMyApplications,
  });
  const jobs = useQuery({ queryKey: ['my-jobs'], queryFn: fetchMyJobs });

  const active = tab === 'applications' ? applications : jobs;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>
            ← {t('notif.back')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={[styles.title, { color: c.text }]}>{t('act.title')}</Text>

        {summary ? (
          <View style={styles.stats}>
            {(
              [
                {
                  label: 'act.stat.applications',
                  value: summary.seeking.applications,
                  icon: '📄',
                  tint: 0,
                  goes: 'applications',
                },
                {
                  label: 'act.stat.posted',
                  value: summary.hiring.jobsPosted,
                  icon: '📢',
                  tint: 2,
                  goes: 'jobs',
                },
                {
                  label: 'act.stat.shortlisted',
                  value: summary.seeking.shortlisted,
                  icon: '⭐',
                  tint: 1,
                  goes: 'applications',
                },
                {
                  label: 'act.stat.active',
                  value: summary.hiring.openJobs,
                  icon: '🟢',
                  tint: 3,
                  goes: 'jobs',
                },
              ] as const
            ).map((s) => (
              <Stat
                key={s.label}
                label={s.label}
                value={s.value}
                icon={s.icon}
                tint={s.tint}
                selected={tab === s.goes}
                onPress={() => setTab(s.goes)}
              />
            ))}
          </View>
        ) : null}

        <View style={[styles.tabs, { backgroundColor: c.surfaceAlt }]}>
          {(['applications', 'jobs'] as const).map((key) => {
            const on = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, on && { backgroundColor: c.surface }]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: on ? c.text : c.textMuted },
                    on && styles.tabTextOn,
                  ]}
                >
                  {t(key === 'applications' ? 'act.tab.applications' : 'act.tab.jobs')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {active.error ? <ErrorBanner message={errorMessage(active.error)} /> : null}

        {active.isLoading ? (
          <ActivityIndicator color={c.primary} style={styles.loading} />
        ) : tab === 'applications' ? (
          <ApplicationList
            items={applications.data?.applications ?? []}
            onOpen={(id) =>
              router.push({ pathname: '/(app)/job/[id]', params: { id } })
            }
          />
        ) : (
          <JobList
            items={jobs.data?.jobs ?? []}
            onOpen={(id) =>
              router.push({ pathname: '/(app)/job/[id]', params: { id } })
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One count, in its own colour.
 *
 * The four tints are the palette the Find work / Hire people cards already
 * use, so the tiles read as part of the same product rather than as a new
 * kind of thing. Colour here is identity, not status: it tells the four
 * numbers apart at a glance, which four identical white boxes could not.
 *
 * Each one is a control, not a label. Tapping a count switches to the list it
 * came from — a number you cannot follow is a dead end, and "12 applications"
 * with the applications a tap away is the whole point of the screen.
 */
function Stat({
  label,
  value,
  icon,
  tint,
  selected,
  onPress,
}: {
  label: TranslationKey;
  value: number;
  icon: string;
  tint: 0 | 1 | 2 | 3;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  // Springs back rather than easing, so a tap feels like pressing something
  // physical instead of watching an animation play.
  const press = useRef(new Animated.Value(0)).current;
  const animate = (to: number) =>
    Animated.spring(press, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const scale = press.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  return (
    <Animated.View style={[styles.statWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPressIn={() => animate(1)}
        onPressOut={() => animate(0)}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${value} ${t(label)}`}
        style={[
          styles.stat,
          {
            backgroundColor: c.tints[tint],
            // The tile whose list is open is ringed rather than recoloured,
            // so the four keep their identities while one is clearly current.
            borderColor: selected ? c.primary : c.tintBorders[tint],
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View style={styles.statTop}>
          <Text style={styles.statIcon}>{icon}</Text>
          <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
        </View>
        <Text style={[styles.statLabel, { color: c.textMuted }]} numberOfLines={1}>
          {t(label)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function ApplicationList({
  items,
  onOpen,
}: {
  items: JobApplication[];
  onOpen: (jobId: string) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  if (items.length === 0) {
    return <Empty icon="📄" title="app.emptyTitle" body="app.emptyBody" />;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable
          key={item.jobId}
          onPress={() => onOpen(item.jobId)}
          accessibilityRole="button"
          accessibilityLabel={item.jobTitle}
          style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text style={[styles.status, { color: c.textMuted }]}>
            {STATUS_DOTS[item.status]} {t(STATUS_KEYS[item.status])}
          </Text>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
            {item.jobTitle}
          </Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
            {item.companyName} · {jobCategoryName(item.category, locale)}
          </Text>
          {!item.jobIsOpen ? (
            <Text style={[styles.closed, { color: c.textMuted }]}>
              {t('app.jobClosed')}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function JobList({
  items,
  onOpen,
}: {
  items: MyJob[];
  onOpen: (jobId: string) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  if (items.length === 0) {
    return <Empty icon="📋" title="myJobs.emptyTitle" body="myJobs.emptyBody" />;
  }

  return (
    <View style={styles.list}>
      {items.map((job) => (
        <Pressable
          key={job.id}
          onPress={() => onOpen(job.id)}
          accessibilityRole="button"
          accessibilityLabel={job.title}
          style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text style={[styles.status, { color: job.isOpen ? c.success : c.textMuted }]}>
            📢 {t(job.isOpen ? 'myJobs.live' : 'myJobs.closed')}
          </Text>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
            {jobCategoryName(job.category, locale)} · {job.location}
          </Text>
          {/* The number a poster is actually here for. Muted at zero, because
              "0 applicants" is not news worth colouring. */}
          <Text
            style={[
              styles.applicants,
              { color: job.applicantCount > 0 ? c.primary : c.textMuted },
            ]}
          >
            👤 {t('myJobs.applicants', { count: job.applicantCount })}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: string;
  title: TranslationKey;
  body: TranslationKey;
}) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{t(title)}</Text>
      <Text style={[styles.emptyBody, { color: c.textMuted }]}>{t(body)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { fontSize: font.sm, fontWeight: '700' },

  scroll: { padding: space.md, paddingBottom: space.fab },
  title: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: space.md,
  },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Sizing lives on the wrapper because the animated transform belongs there —
  // scaling a flex child directly fights the layout it is inside.
  statWrap: { flexGrow: 1, flexBasis: '46%' },
  stat: { borderRadius: radius.lg, padding: 14 },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: font.xs, marginTop: 2, fontWeight: '600' },

  tabs: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    marginTop: space.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  tabText: { fontSize: font.sm, fontWeight: '700' },
  tabTextOn: { fontWeight: '800' },

  loading: { marginTop: space.lg },
  list: { marginTop: space.md, gap: 10 },
  row: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 4 },
  status: { fontSize: font.xs, fontWeight: '800' },
  rowTitle: { fontSize: font.md, fontWeight: '800' },
  rowMeta: { fontSize: font.xs },
  applicants: { fontSize: font.sm, fontWeight: '800', marginTop: 4 },
  closed: { fontSize: font.xs, fontWeight: '700', marginTop: 4 },

  empty: { alignItems: 'center', paddingTop: space.xl },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
});
