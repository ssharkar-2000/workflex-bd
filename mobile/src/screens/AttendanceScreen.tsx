import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Avatar, EmptyState, ErrorState, FilterTabs, Loading, Meter, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';

type AttendanceRecord = {
  id: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
  checkInAt: string | null;
  checkOutAt: string | null;
  gpsFlagged: boolean;
  worker: { id: string; fullName: string; initials: string; profession: string };
  job: { id: string; title: string } | null;
};

type Summary = {
  date: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  gpsFlagged: number;
  attendanceRate: number;
};

type Filter = 'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';

/// "2026-08-17T08:12:00Z" -> "8:12 AM"
function clock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function AttendanceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');

  const summary = useApi<Summary>('/attendance/summary');
  const query = filter === 'ALL' ? '' : `?status=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<AttendanceRecord>>(
    `/attendance${query}`,
    [filter],
  );

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <Text style={text.screenTitle}>Attendance</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {summary.data?.date ?? 'Today'}
            </Text>

            {summary.data ? (
              <View style={[s.summary, shadow.card]}>
                <View style={s.rateRow}>
                  <Text style={text.label}>Attendance rate</Text>
                  <Text style={s.rate}>{summary.data.attendanceRate}%</Text>
                </View>
                <Meter percent={summary.data.attendanceRate} color={colors.greenText} />

                <View style={s.tiles}>
                  <Tile value={summary.data.present} label="Present" color={colors.greenText} />
                  <Tile value={summary.data.late} label="Late" color={colors.amber} />
                  <Tile value={summary.data.absent} label="Absent" color={colors.red} />
                  <Tile value={summary.data.onLeave} label="On leave" color={colors.slate} />
                </View>

                {summary.data.gpsFlagged > 0 ? (
                  <View style={s.flagged}>
                    <Text style={s.flaggedText}>
                      ⚠ {summary.data.gpsFlagged} check-in
                      {summary.data.gpsFlagged === 1 ? '' : 's'} flagged for GPS mismatch
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <FilterTabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'PRESENT', label: 'Present' },
                { value: 'LATE', label: 'Late' },
                { value: 'ABSENT', label: 'Absent' },
                { value: 'ON_LEAVE', label: 'Leave' },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <EmptyState title="Nothing recorded" hint="No attendance rows for this day yet." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('WorkerProfile', { id: item.worker.id })}
            style={({ pressed }) => [s.card, shadow.card, pressed && { opacity: 0.9 }]}
          >
            <Avatar initials={item.worker.initials} size={40} />
            <View style={s.grow}>
              <View style={s.row}>
                <Text style={text.cardTitle} numberOfLines={1}>
                  {item.worker.fullName}
                </Text>
                <StatusPill value={item.status} />
              </View>
              <Text style={text.caption} numberOfLines={1}>
                {item.job?.title ?? item.worker.profession}
              </Text>
              <Text style={[text.micro, { marginTop: 2 }]}>
                In {clock(item.checkInAt)} · Out {clock(item.checkOutAt)}
                {item.gpsFlagged ? '  ⚠ GPS' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function Tile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={s.tile}>
      <Text style={[s.tileValue, { color }]}>{value}</Text>
      <Text style={text.micro}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rate: { fontSize: 18, fontWeight: '700', color: colors.greenText },
  tiles: { flexDirection: 'row', marginTop: spacing.md },
  tile: { flex: 1, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '700' },
  flagged: {
    backgroundColor: colors.amberBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  flaggedText: { ...text.caption, color: colors.amberText, fontWeight: '600' },

  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  grow: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
