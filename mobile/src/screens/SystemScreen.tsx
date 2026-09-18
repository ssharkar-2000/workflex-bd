import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Card, DetailRow, ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { colors, spacing, text } from '../theme';

type Health = {
  database: { reachable: boolean; latencyMs: number };
  uptimeSeconds: number;
  nodeVersion: string;
  rowCounts: { workers: number; jobs: number; transactions: number; alerts: number };
};

/// 93784 -> "1d 2h 3m"
function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

export function SystemScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<Health>('/system/health');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>System Management</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.row}>
          <Text style={text.sectionTitle}>Database</Text>
          <StatusPill
            value={data.database.reachable ? 'APPROVED' : 'FAILED'}
            label={data.database.reachable ? 'Reachable' : 'Down'}
          />
        </View>
        <Text style={[text.caption, { marginTop: spacing.xs }]}>
          Responded in {data.database.latencyMs}ms
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Runtime" />
        <DetailRow label="Uptime" value={uptime(data.uptimeSeconds)} />
        <DetailRow label="Node" value={data.nodeVersion} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Table sizes" />
        <DetailRow label="Workers" value={data.rowCounts.workers.toLocaleString('en-IN')} />
        <DetailRow label="Jobs" value={data.rowCounts.jobs.toLocaleString('en-IN')} />
        <DetailRow label="Transactions" value={data.rowCounts.transactions.toLocaleString('en-IN')} />
        <DetailRow label="Alerts" value={data.rowCounts.alerts.toLocaleString('en-IN')} />
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
