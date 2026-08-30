import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobCategoryName, type MyJob } from '@workflex/shared';
import { fetchMyJobs, setJobOpen } from '../../src/api/jobs';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/** What someone who has posted work needs: is it live, and did anyone save it. */
export default function MyJobsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: fetchMyJobs,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isOpen }: { id: string; isOpen: boolean }) =>
      setJobOpen(id, isOpen),
    onSuccess: (next) => {
      queryClient.setQueryData(['my-jobs'], next);
      // The seeker feed must stop showing a posting the moment it closes.
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const jobs = data?.jobs ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>← {t('notif.back')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/post-job')}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.newJob, { color: c.primary }]}>
            + {t('menu.postJob')}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: c.text }]}>{t('myJobs.title')}</Text>

        {error ? <ErrorBanner message={errorMessage(error)} /> : null}

        {isLoading ? (
          <ActivityIndicator color={c.primary} style={styles.loading} />
        ) : jobs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {t('myJobs.emptyTitle')}
            </Text>
            <Text style={[styles.emptyBody, { color: c.textMuted }]}>
              {t('myJobs.emptyBody')}
            </Text>
          </View>
        ) : (
          jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onOpen={() =>
                router.push({ pathname: '/(app)/job/[id]', params: { id: job.id } })
              }
              onToggle={() => toggle.mutate({ id: job.id, isOpen: !job.isOpen })}
              busy={toggle.isPending}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function JobRow({
  job,
  onOpen,
  onToggle,
  busy,
}: {
  job: MyJob;
  onOpen: () => void;
  onToggle: () => void;
  busy: boolean;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Opening the posting and closing it are siblings, not nested — a
          button inside a button is invalid DOM on web. */}
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={job.title}>
        <View style={styles.cardTop}>
          <Text style={[styles.jobTitle, { color: c.text }]} numberOfLines={2}>
            {job.title}
          </Text>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: job.isOpen ? c.successSoft : c.surfaceAlt,
                borderColor: job.isOpen ? c.success : c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: job.isOpen ? c.success : c.textMuted },
              ]}
            >
              {t(job.isOpen ? 'myJobs.live' : 'myJobs.closed')}
            </Text>
          </View>
        </View>

        <Text style={[styles.meta, { color: c.textMuted }]}>
          {jobCategoryName(job.category, locale)} · {job.location}
        </Text>

        <Text style={[styles.saved, { color: c.textMuted }]}>
          {t('myJobs.savedBy', { count: job.savedByCount })}
        </Text>

        {/* Applicants are highlighted rather than muted like the save count:
            someone applying is the thing a poster actually has to act on. */}
        {job.applicantCount > 0 ? (
          <Text style={[styles.applicants, { color: c.primary }]}>
            👤 {t('myJobs.applicants', { count: job.applicantCount })}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        onPress={onToggle}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.toggle}
      >
        <Text
          style={[styles.toggleText, { color: job.isOpen ? c.danger : c.primary }]}
        >
          {t(job.isOpen ? 'myJobs.close' : 'myJobs.reopen')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  back: { fontSize: font.sm, fontWeight: '700' },
  newJob: { fontSize: font.sm, fontWeight: '800' },

  scroll: { padding: space.md, paddingBottom: space.xl },
  title: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: space.md,
  },
  loading: { marginTop: space.lg },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  jobTitle: { flex: 1, fontSize: font.md, fontWeight: '800' },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: { fontSize: font.xs - 1, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 6 },
  saved: { fontSize: font.xs, marginTop: 6, fontWeight: '600' },
  applicants: { fontSize: font.sm, marginTop: 6, fontWeight: '800' },
  toggle: { marginTop: 12 },
  toggleText: { fontSize: font.sm, fontWeight: '700' },

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
