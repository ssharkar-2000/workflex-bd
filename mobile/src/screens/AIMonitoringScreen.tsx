import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Alert, Page } from '../api/types';
import { ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { taka, timeAgo } from '../theme/format';

export function AIMonitoringScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const summary = useApi<{ aiMatches: number; gpsAlerts: number; fraudSaved: number; online: boolean }>(
    '/alerts/summary',
  );
  const { data, loading, error, refetch } = useApi<Page<Alert>>('/alerts');

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
            <View style={s.head}>
              <Text style={text.screenTitle}>AI Monitoring</Text>
              {summary.data?.online ? (
                <View style={s.online}>
                  <Text style={s.onlineText}>● Online</Text>
                </View>
              ) : null}
            </View>

            {summary.data ? (
              <View style={s.grid}>
                <StatTile value={summary.data.aiMatches.toLocaleString('en-IN')} label="AI Matches" />
                <StatTile value={taka(summary.data.fraudSaved, true)} label="Fraud Saved" />
                <StatTile value={String(summary.data.gpsAlerts)} label="GPS Alerts" />
              </View>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Suspicious Activity" />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? <ErrorState message={error} onRetry={refetch} /> : loading ? <Loading /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('AlertDetail', { id: item.id })}
            style={({ pressed }) => [s.card, shadow.card, pressed && { opacity: 0.9 }]}
          >
            <View style={s.row}>
              <View style={s.grow}>
                <Text style={text.cardTitle}>{item.message}</Text>
                <Text style={[text.caption, { marginTop: spacing.xs }]}>
                  {item.subjectName} · {timeAgo(item.detectedAt)}
                </Text>
              </View>
              <View style={s.pills}>
                <StatusPill value={item.severity} />
                {item.status !== 'OPEN' ? <StatusPill value={item.status} /> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={[s.tile, shadow.card]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  online: { backgroundColor: colors.greenBg, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  onlineText: { color: colors.greenText, fontSize: 11, fontWeight: '700' },

  grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },

  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  grow: { flex: 1 },
  pills: { gap: spacing.xs, alignItems: 'flex-end' },
});
