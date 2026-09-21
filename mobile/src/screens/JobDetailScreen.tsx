import React, { useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Job } from '../api/types';
import { Avatar, Button, Card, Chip, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { colors, spacing, text } from '../theme';
import { experience, longDate, salaryRange } from '../theme/format';

export function JobDetailScreen({ route }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { data: job, loading, error, refetch } = useApi<Job>(`/jobs/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !job) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!job) return null;

  const run = async (action: string, body?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/jobs/${id}/${action}`, { method: 'POST', body });
      await refetch();
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Job Details</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.head}>
          <Avatar initials={job.company.initials} size={48} />
          <View style={s.grow}>
            <Text style={s.title}>{job.title}</Text>
            <Text style={text.caption}>{job.company.name}</Text>
          </View>
          <StatusPill value={job.status} />
        </View>
        <Text style={s.salary}>{salaryRange(job.salaryMin, job.salaryMax)}</Text>
        <View style={s.chipRow}>
          <Chip label={`${job.category.icon} ${job.category.name}`} />
          <Chip label={job.availability === 'FULL_TIME' ? 'Full-time' : 'Part-time'} />
          <Chip label={experience(job.experienceMonths)} />
          {job.featured ? <Chip label="⭐ Featured" /> : null}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={text.sectionTitle}>Description</Text>
        <Text style={[text.body, { marginTop: spacing.sm }]}>{job.description}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="Reference" value={job.code} />
        <DetailRow label="Location" value={job.location} />
        <DetailRow label="Posted" value={longDate(job.postedAt)} />
        <DetailRow label="Applications" value={String(job._count.applications)} />
        <DetailRow label="Views" value={job.views.toLocaleString('en-IN')} />
      </Card>

      {job.rejectionReason ? (
        <Card style={[s.rejection, { marginTop: spacing.lg }]}>
          <Text style={s.rejectionTitle}>Why this was rejected</Text>
          <Text style={[text.body, { marginTop: spacing.xs }]}>{job.rejectionReason}</Text>
        </Card>
      ) : null}

      <View style={s.actions}>
        {job.status === 'PENDING' ? (
          <>
            <Button label="Approve" variant="success" loading={busy} onPress={() => run('approve')} />
            <Button
              label="Reject"
              variant="danger"
              loading={busy}
              onPress={() => run('reject', { reason: 'Did not meet posting guidelines' })}
            />
          </>
        ) : null}
        {job.status === 'APPROVED' ? (
          <Button
            label={job.featured ? 'Remove from featured' : 'Feature this job'}
            variant="outline"
            loading={busy}
            onPress={() => run(job.featured ? 'unfeature' : 'feature')}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  grow: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textDark },
  salary: { fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  rejection: { backgroundColor: colors.redBg },
  rejectionTitle: { ...text.label, color: colors.redText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
});
