import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { BarChart, Card, ErrorState, Loading, SectionHeader } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { taka } from '../theme/format';

type Analytics = {
  revenueSeries: { month: string; total: number }[];
  workerSeries: { month: string; total: number }[];
  platformRating: number;
  reviewCount: number;
  jobFillRate: number;
  avgHireDays: number;
};

export function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<Analytics>('/dashboard/analytics');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const monthLabel = (month: string) =>
    new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'short' });

  const revenue = data.revenueSeries.slice(-6).map((p) => ({ label: monthLabel(p.month), value: p.total }));
  const workers = data.workerSeries.slice(-6).map((p) => ({ label: monthLabel(p.month), value: p.total }));

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Analytics</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Revenue" />
        <Text style={[text.caption, { marginBottom: spacing.lg }]}>
          Last 6 months · {taka(revenue.reduce((sum, p) => sum + p.value, 0), true)} total
        </Text>
        <BarChart data={revenue} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Worker Growth" />
        <Text style={[text.caption, { marginBottom: spacing.lg }]}>Active workers by month</Text>
        <BarChart data={workers} />
      </Card>

      <View style={s.grid}>
        <KpiTile
          value={`${data.platformRating.toFixed(1)}/5.0`}
          label="Platform Rating"
          hint={`${data.reviewCount.toLocaleString('en-IN')} reviews`}
        />
        <KpiTile value={`${data.jobFillRate}%`} label="Job Fill Rate" hint="approved vs total" />
        <KpiTile value={`${data.avgHireDays} days`} label="Avg. Hire Time" hint="apply to offer" />
        <KpiTile
          value={workers.length ? workers[workers.length - 1].value.toLocaleString('en-IN') : '—'}
          label="Active Workers"
          hint="latest month"
        />
      </View>
    </ScrollView>
  );
}

function KpiTile({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <View style={[s.tile, shadow.card]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.label, { marginTop: 2 }]}>{label}</Text>
      <Text style={text.micro}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
});
