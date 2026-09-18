import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Job, Page } from '../api/types';
import { Avatar, Button, Chip, ErrorState, FilterTabs, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { experience, salaryRange, timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Filter = 'ALL' | 'PENDING' | 'APPROVED' | 'FEATURED' | 'REJECTED';
type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

const QUERY: Record<Filter, string> = {
  ALL: '',
  PENDING: '?status=PENDING',
  APPROVED: '?status=APPROVED',
  FEATURED: '?featured=true',
  REJECTED: '?status=REJECTED',
};

export function JobsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useApi<Record<string, number>>('/jobs/status-counts');
  const { data, loading, error, refetch } = useApi<Page<Job>>(`/jobs${QUERY[filter]}`, [filter]);

  const review = async (job: Job, action: 'approve' | 'reject') => {
    setBusyId(job.id);
    try {
      await api(`/jobs/${job.id}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? { reason: t('jobs.defaultRejectReason') } : undefined,
      });
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <View style={s.headRow}>
          <Text style={text.screenTitle}>{t('jobs.title')}</Text>
          <Pressable style={s.postButton} onPress={() => navigation.navigate('PostJob')}>
            <Text style={s.postLabel}>{t('jobs.post')}</Text>
          </Pressable>
        </View>
        <Pressable style={s.analyticsLink} onPress={() => navigation.navigate('JobAnalytics')}>
          <Text style={s.analyticsLinkText}>{t('jobAnalytics.title')}</Text>
          <Text style={s.analyticsLinkArrow}>›</Text>
        </Pressable>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t('common.all'), count: counts.data?.all },
            { value: 'PENDING', label: t('jobs.pending'), count: counts.data?.pending },
            { value: 'APPROVED', label: t('jobs.approved'), count: counts.data?.approved },
            { value: 'FEATURED', label: t('jobs.featured'), count: counts.data?.featured },
            { value: 'REJECTED', label: t('reports.rejected'), count: counts.data?.rejected },
          ]}
        />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          onRefresh={refetch}
          refreshing={loading}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              busy={busyId === item.id}
              onPress={() => navigation.navigate('JobDetail', { id: item.id })}
              onApprove={() => review(item, 'approve')}
              onReject={() => review(item, 'reject')}
              styles={s}
              text={text}
              shadow={shadow}
              t={t}
              tint={categoryTint(categoryPalette, item.id).bg}
            />
          )}
        />
      )}
    </View>
  );
}

function JobCard({
  job,
  busy,
  onPress,
  onApprove,
  onReject,
  styles,
  text,
  shadow,
  t,
  tint,
}: {
  job: Job;
  busy: boolean;
  onPress: () => void;
  onApprove: () => void;
  onReject: () => void;
  styles: Styles;
  text: Txt;
  shadow: { card: object };
  t: (key: string, vars?: Record<string, string | number>) => string;
  tint?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadow.card, tint ? { backgroundColor: tint } : null, pressed && { opacity: 0.9 }]}>
      <View style={styles.banner}>
        {job.status === 'PENDING' ? <Text style={styles.bannerText}>{t('jobs.pendingReview')}</Text> : null}
        {job.featured ? <Text style={[styles.bannerText, styles.featured]}>{t('jobs.featuredBanner')}</Text> : null}
        {job.urgency === 'URGENT' ? <Text style={[styles.bannerText, styles.urgent]}>{t('jobs.urgent')}</Text> : null}
      </View>

      <View style={styles.cardTop}>
        <Avatar initials={job.company.initials} size={40} />
        <View style={styles.grow}>
          <View style={styles.titleRow}>
            <Text style={text.cardTitle} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={styles.salary}>{salaryRange(job.salaryMin, job.salaryMax)}</Text>
          </View>
          <Text style={text.caption} numberOfLines={1}>
            {job.location}
          </Text>
          <Text style={[text.micro, { marginTop: 2 }]}>{timeAgo(job.postedAt, t)}</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <Chip label={`${job.category.icon} ${job.category.name}`} />
        <Chip label={job.availability === 'FULL_TIME' ? t('workers.fullTime') : t('workers.partTime')} />
        <Chip label={experience(job.experienceMonths, t)} />
      </View>

      <Text style={text.body} numberOfLines={2}>
        {job.description}
      </Text>

      {job.status === 'PENDING' ? (
        <View style={styles.actions}>
          <Button label={t('common.approve')} variant="success" loading={busy} onPress={onApprove} />
          <Button label={t('common.reject')} variant="danger" loading={busy} onPress={onReject} />
        </View>
      ) : job.status === 'REJECTED' && job.rejectionReason ? (
        <Text style={styles.rejection} numberOfLines={2}>
          {t('jobs.rejectedReason', { reason: job.rejectionReason })}
        </Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    postButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    postLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
    analyticsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primarySoft,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
    },
    analyticsLinkText: { ...text.label, color: colors.primary },
    analyticsLinkArrow: { color: colors.primary, fontSize: 18, fontWeight: '700' },

    list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },

    banner: { flexDirection: 'row', gap: spacing.sm },
    bannerText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.amberText,
      backgroundColor: colors.amberBg,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    featured: { color: colors.primary, backgroundColor: colors.primarySoft },
    urgent: { color: colors.redText, backgroundColor: colors.redBg },

    cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    grow: { flex: 1 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    salary: { fontSize: 13, fontWeight: '700', color: colors.primary },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    actions: { flexDirection: 'row', gap: spacing.sm },
    rejection: { ...text.caption, color: colors.redText },
  });
}
