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
import { useQuery } from '@tanstack/react-query';
import {
  jobCategoryName,
  type ApplicationStatus,
  type JobApplication,
} from '@workflex/shared';
import { fetchMyApplications } from '../../src/api/jobs';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

const STATUS_KEYS: Record<ApplicationStatus, TranslationKey> = {
  SUBMITTED: 'app.status.SUBMITTED',
  VIEWED: 'app.status.VIEWED',
  SHORTLISTED: 'app.status.SHORTLISTED',
  ACCEPTED: 'app.status.ACCEPTED',
  REJECTED: 'app.status.REJECTED',
  WITHDRAWN: 'app.status.WITHDRAWN',
};

/** What someone who has applied needs: where each application stands. */
export default function ApplicationsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const errorMessage = useErrorMessage();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-applications'],
    queryFn: fetchMyApplications,
  });

  const applications = data?.applications ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: c.primary }]}>← {t('notif.back')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/jobs')}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.findJobs, { color: c.primary }]}>
            {t('menu.findJobs')}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: c.text }]}>
          {t('menu.myApplications')}
        </Text>

        {error ? <ErrorBanner message={errorMessage(error)} /> : null}

        {isLoading ? (
          <ActivityIndicator color={c.primary} style={styles.loading} />
        ) : applications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {t('app.emptyTitle')}
            </Text>
            <Text style={[styles.emptyBody, { color: c.textMuted }]}>
              {t('app.emptyBody')}
            </Text>
          </View>
        ) : (
          applications.map((application) => (
            <ApplicationRow
              key={application.jobId}
              application={application}
              onOpen={() =>
                router.push({
                  pathname: '/(app)/job/[id]',
                  params: { id: application.jobId },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ApplicationRow({
  application,
  onOpen,
}: {
  application: JobApplication;
  onOpen: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  // Colour carries the outcome, so the list can be read at a glance rather
  // than word by word. Everything still in play stays neutral — an employer
  // not having looked yet is not bad news.
  const tone =
    application.status === 'ACCEPTED' || application.status === 'SHORTLISTED'
      ? { fill: c.successSoft, line: c.success, text: c.success }
      : application.status === 'REJECTED' || application.status === 'WITHDRAWN'
        ? { fill: c.surfaceAlt, line: c.border, text: c.textMuted }
        : { fill: c.primarySoft, line: c.primarySoftBorder, text: c.primary };

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={application.jobTitle}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.jobTitle, { color: c.text }]} numberOfLines={2}>
          {application.jobTitle}
        </Text>
        <View
          style={[styles.pill, { backgroundColor: tone.fill, borderColor: tone.line }]}
        >
          <Text style={[styles.pillText, { color: tone.text }]}>
            {t(STATUS_KEYS[application.status])}
          </Text>
        </View>
      </View>

      <Text style={[styles.meta, { color: c.textMuted }]}>
        {application.companyName} ·{' '}
        {jobCategoryName(application.category, locale)} · {application.location}
      </Text>

      <Text style={[styles.meta, { color: c.textMuted }]}>
        {t('app.appliedOn', {
          date: new Date(application.appliedAt).toLocaleDateString(
            locale === 'bn' ? 'bn-BD' : 'en-GB',
            { day: 'numeric', month: 'short', year: 'numeric' },
          ),
        })}
      </Text>

      {/* Kept on the list once closed rather than removed: an application
          vanishing reads as lost, and they are entitled to see they applied. */}
      {!application.jobIsOpen ? (
        <Text style={[styles.closed, { color: c.textMuted }]}>
          {t('app.jobClosed')}
        </Text>
      ) : null}
    </Pressable>
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
  findJobs: { fontSize: font.sm, fontWeight: '800' },

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
  closed: { fontSize: font.xs, marginTop: 8, fontWeight: '700' },

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
