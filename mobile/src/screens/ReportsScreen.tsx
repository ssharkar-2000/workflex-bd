import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Card, ErrorState, Loading, SectionHeader } from '../components';
import { colors, spacing, text } from '../theme';
import { taka } from '../theme/format';

type Report = {
  range: { from: string; to: string };
  workforce: { total: number; active: number; pending: number; suspended: number; newInPeriod: number };
  hiring: {
    totalJobs: number;
    approved: number;
    pending: number;
    rejected: number;
    postedInPeriod: number;
    hiresInPeriod: number;
  };
  money: { revenue: number; transactionCount: number; refunded: number; failedCount: number };
  trustAndSafety: {
    verificationsApproved: number;
    verificationsPending: number;
    criticalAlerts: number;
    highAlerts: number;
    complaintsResolvedInPeriod: number;
  };
};

export function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<Report>('/reports/summary');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Reports</Text>
      <Text style={[text.caption, { marginTop: spacing.xs }]}>
        {data.range.from} to {data.range.to}
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Workforce" />
        <Row label="Total workers" value={data.workforce.total} />
        <Row label="Active" value={data.workforce.active} />
        <Row label="Pending verification" value={data.workforce.pending} />
        <Row label="Suspended" value={data.workforce.suspended} />
        <Row label="Joined in period" value={data.workforce.newInPeriod} highlight />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Hiring" />
        <Row label="Total jobs" value={data.hiring.totalJobs} />
        <Row label="Approved" value={data.hiring.approved} />
        <Row label="Awaiting review" value={data.hiring.pending} />
        <Row label="Rejected" value={data.hiring.rejected} />
        <Row label="Posted in period" value={data.hiring.postedInPeriod} />
        <Row label="Hires in period" value={data.hiring.hiresInPeriod} highlight />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Money" />
        <Row label="Revenue" value={taka(data.money.revenue, true)} highlight />
        <Row label="Transactions" value={data.money.transactionCount} />
        <Row label="Refunded" value={taka(data.money.refunded, true)} />
        <Row label="Failed" value={data.money.failedCount} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Trust & Safety" />
        <Row label="Verifications approved" value={data.trustAndSafety.verificationsApproved} />
        <Row label="Verifications pending" value={data.trustAndSafety.verificationsPending} />
        <Row label="Critical alerts" value={data.trustAndSafety.criticalAlerts} />
        <Row label="High alerts" value={data.trustAndSafety.highAlerts} />
        <Row label="Complaints resolved" value={data.trustAndSafety.complaintsResolvedInPeriod} />
      </Card>

      <Text style={s.note}>
        A CSV of every transaction in this window is available at
        /api/reports/transactions.csv
      </Text>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={text.body}>{label}</Text>
      <Text style={[s.value, highlight && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  value: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  note: { ...text.micro, marginTop: spacing.lg, lineHeight: 16 },
});
