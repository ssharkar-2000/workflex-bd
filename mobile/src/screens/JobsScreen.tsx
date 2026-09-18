import React, { useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Job, Page } from '../api/types';
import { Avatar, Button, Chip, ErrorState, FilterTabs, Loading } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { experience, salaryRange, timeAgo } from '../theme/format';

type Filter = 'ALL' | 'PENDING' | 'APPROVED' | 'FEATURED' | 'REJECTED';

const QUERY: Record<Filter, string> = {
  ALL: '',
  PENDING: '?status=PENDING',
  APPROVED: '?status=APPROVED',
  FEATURED: '?featured=true',
  REJECTED: '?status=REJECTED',
};

export function JobsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useApi<Record<string, number>>('/jobs/status-counts');
  const { data, loading, error, refetch } = useApi<Page<Job>>(`/jobs${QUERY[filter]}`, [filter]);

  const review = async (job: Job, action: 'approve' | 'reject') => {
    setBusyId(job.id);
    try {
      await api(`/jobs/${job.id}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? { reason: 'Did not meet posting guidelines' } : undefined,
      });
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <View style={s.headRow}>
          <Text style={text.screenTitle}>All Jobs</Text>
          <Pressable style={s.postButton} onPress={() => navigation.navigate('PostJob')}>
            <Text style={s.postLabel}>+ Post</Text>
          </Pressable>
        </View>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All', count: counts.data?.all },
            { value: 'PENDING', label: 'Pending', count: counts.data?.pending },
            { value: 'APPROVED', label: 'Approved', count: counts.data?.approved },
            { value: 'FEATURED', label: 'Featured', count: counts.data?.featured },
            { value: 'REJECTED', label: 'Rejected', count: counts.data?.rejected },
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
}: {
  job: Job;
  busy: boolean;
  onPress: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, shadow.card, pressed && { opacity: 0.9 }]}>
      <View style={s.banner}>
        {job.status === 'PENDING' ? <Text style={s.bannerText}>PENDING REVIEW</Text> : null}
        {job.featured ? <Text style={[s.bannerText, s.featured]}>FEATURED</Text> : null}
        {job.urgency === 'URGENT' ? <Text style={[s.bannerText, s.urgent]}>URGENT</Text> : null}
      </View>

      <View style={s.cardTop}>
        <Avatar initials={job.company.initials} size={40} />
        <View style={s.grow}>
          <View style={s.titleRow}>
            <Text style={text.cardTitle} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={s.salary}>{salaryRange(job.salaryMin, job.salaryMax)}</Text>
          </View>
          <Text style={text.caption} numberOfLines={1}>
            {job.location}
          </Text>
          <Text style={[text.micro, { marginTop: 2 }]}>{timeAgo(job.postedAt)}</Text>
        </View>
      </View>

      <View style={s.chipRow}>
        <Chip label={`${job.category.icon} ${job.category.name}`} />
        <Chip label={job.availability === 'FULL_TIME' ? 'Full-time' : 'Part-time'} />
        <Chip label={experience(job.experienceMonths)} />
      </View>

      <Text style={text.body} numberOfLines={2}>
        {job.description}
      </Text>

      {job.status === 'PENDING' ? (
        <View style={s.actions}>
          <Button label="Approve" variant="success" loading={busy} onPress={onApprove} />
          <Button label="Reject" variant="danger" loading={busy} onPress={onReject} />
        </View>
      ) : job.status === 'REJECTED' && job.rejectionReason ? (
        <Text style={s.rejection}>Rejected — {job.rejectionReason}</Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
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
