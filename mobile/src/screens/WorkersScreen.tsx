import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page, Worker, WorkerStatus } from '../api/types';
import { Avatar, Chip, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { experience, taka } from '../theme/format';

type Filter = 'ALL' | WorkerStatus;

export function WorkersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');

  const counts = useApi<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
  }>('/workers/status-counts');

  const query = filter === 'ALL' ? '' : `?status=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<Worker>>(`/workers${query}`, [filter]);

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Text style={text.screenTitle}>Explore All Workers</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All', count: counts.data?.total },
            { value: 'ACTIVE', label: 'Active', count: counts.data?.active },
            { value: 'PENDING', label: 'Pending', count: counts.data?.pending },
            { value: 'SUSPENDED', label: 'Suspended', count: counts.data?.suspended },
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
            <WorkerCard
              worker={item}
              onPress={() => navigation.navigate('WorkerProfile', { id: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

function WorkerCard({ worker, onPress }: { worker: Worker; onPress: () => void }) {
  const skills = worker.skills ?? [];
  const shown = skills.slice(0, 3);
  const extra = skills.length - shown.length;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, shadow.card, pressed && s.pressed]}>
      <View style={s.cardTop}>
        <Avatar initials={worker.initials} />
        <View style={s.grow}>
          <View style={s.nameRow}>
            <Text style={text.cardTitle}>{worker.fullName}</Text>
            <StatusPill value={worker.status} />
          </View>
          <Text style={text.caption}>
            {worker.profession} · {experience(worker.experienceMonths)}
          </Text>
          <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={1}>
            📍 {worker.address}
          </Text>
        </View>
      </View>

      <View style={s.chipRow}>
        {shown.map((skill) => (
          <Chip key={skill.name} label={skill.name} />
        ))}
        {extra > 0 ? <Chip label={`+${extra} more`} /> : null}
      </View>

      <View style={s.statRow}>
        <Stat value={worker.rating.toFixed(1)} label="Rating" />
        <Stat value={String(worker.totalJobs)} label="Jobs" />
        <Stat value={`${worker.trustScore}%`} label="Trust" />
        <Stat value={worker.salaryMin ? taka(worker.salaryMin) : '—'} label="Salary" />
      </View>

      <View style={s.footer}>
        <Text style={text.micro} numberOfLines={1}>
          Last: {worker.lastCompany ?? 'No history'}
        </Text>
        <Chip label={worker.availability === 'FULL_TIME' ? 'Full-time' : 'Part-time'} />
      </View>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={text.micro}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },

  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  pressed: { opacity: 0.9 },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },

  statRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.textDark },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
