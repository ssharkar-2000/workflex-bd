import React, { useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Worker } from '../api/types';
import {
  Avatar,
  Button,
  Card,
  Chip,
  DetailRow,
  ErrorState,
  Loading,
  Meter,
  SectionHeader,
  StatusPill,
} from '../components';
import { colors, radii, spacing, text } from '../theme';
import { experience, longDate, taka } from '../theme/format';

export function WorkerProfileScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { data: worker, loading, error, refetch } = useApi<Worker>(`/workers/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !worker) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!worker) return null;

  const act = async (path: string, body?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/workers/${id}/${path}`, { method: 'POST', body });
      await refetch();
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmSuspend = () => {
    RNAlert.alert(
      'Suspend this worker?',
      `${worker.fullName} will lose access to new jobs until reinstated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: () => act('suspend', { reason: 'Suspended by admin review' }),
        },
      ],
    );
  };

  const trustColor =
    worker.trustScore >= 85 ? colors.greenText : worker.trustScore >= 70 ? colors.amber : colors.red;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Worker Profile</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.identity}>
          <Avatar initials={worker.initials} size={64} />
          <View style={s.grow}>
            <Text style={s.name}>{worker.fullName}</Text>
            <Text style={text.caption}>
              {worker.profession} · {worker.code}
            </Text>
            <View style={s.ratingRow}>
              <Text style={s.rating}>★ {worker.rating.toFixed(1)}</Text>
              <Text style={text.micro}>({worker.reviewCount})</Text>
              <StatusPill value={worker.status} />
            </View>
          </View>
        </View>

        <View style={s.trust}>
          <View style={s.trustHead}>
            <Text style={text.label}>Trust Score</Text>
            <Text style={[text.label, { color: trustColor }]}>{worker.trustScore}/100</Text>
          </View>
          <Meter percent={worker.trustScore} color={trustColor} />
        </View>

        <View style={s.statRow}>
          <Stat value={String(worker.totalJobs)} label="Total Jobs" />
          <Stat value={taka(worker.totalEarnings, true)} label="Total Earnings" />
          <Stat value={`${worker.completionRate}%`} label="Completion Rate" />
        </View>
      </Card>

      {worker.bio ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Bio" />
          <Text style={text.body}>{worker.bio}</Text>
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Skills" />
        <View style={s.chipRow}>
          {(worker.skills ?? []).map((skill) => (
            <Chip key={skill.name} label={skill.name} />
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="Phone" value={worker.phone} />
        <DetailRow label="Email" value={worker.email ?? '—'} />
        <DetailRow label="Address" value={worker.address} />
        <DetailRow label="Joined" value={longDate(worker.joinedAt)} />
        <DetailRow label="Experience" value={experience(worker.experienceMonths)} />
        <DetailRow label="Education" value={worker.education ?? '—'} />
        <DetailRow label="Last Company" value={worker.lastCompany ?? '—'} />
        <DetailRow
          label="Preferred Salary"
          value={
            worker.salaryMin && worker.salaryMax
              ? `${taka(worker.salaryMin)}–${taka(worker.salaryMax)}`
              : '—'
          }
        />
        <DetailRow
          label="Availability"
          value={worker.availability === 'FULL_TIME' ? 'Full-time' : 'Part-time'}
        />
      </Card>

      {(worker.certifications ?? []).length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Certifications" />
          {worker.certifications!.map((cert) => (
            <View key={cert.id} style={s.certRow}>
              <Text style={s.certTick}>✓</Text>
              <Text style={text.body}>
                {cert.name}
                {cert.issuer ? ` (${cert.issuer})` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={s.actions}>
        <Button
          label="Edit Profile"
          variant="outline"
          onPress={() => navigation.navigate('EditWorker', { id })}
        />
        <Button
          label="View History"
          variant="outline"
          onPress={() => navigation.navigate('JobHistory', { id, name: worker.fullName })}
        />
        {worker.status === 'SUSPENDED' ? (
          <Button label="Reinstate" variant="success" loading={busy} onPress={() => act('reinstate')} />
        ) : (
          <>
            {worker.status !== 'ACTIVE' ? (
              <Button label="Verify" variant="success" loading={busy} onPress={() => act('verify')} />
            ) : null}
            <Button label="Suspend" variant="danger" loading={busy} onPress={confirmSuspend} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={[text.micro, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  identity: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  grow: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: colors.textDark },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  rating: { fontSize: 13, fontWeight: '700', color: colors.amber },

  trust: { marginTop: spacing.xl },
  trustHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },

  statRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textDark },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  certRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  certTick: { color: colors.greenText, fontWeight: '700' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
});
