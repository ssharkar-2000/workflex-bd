import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../../src/api/admin';
import { errorText } from '../../src/lib/error-message';
import { useAdminStore } from '../../src/store/admin-store';
import {
  Badge,
  Card,
  ErrorState,
  Loading,
  Screen,
  StatTile,
} from '../../src/components/ui';
import { colors, font, space } from '../../src/lib/theme';

export default function DashboardScreen() {
  const admin = useAdminStore((s) => s.admin);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
  });

  return (
    <Screen
      title="Dashboard"
      subtitle={admin ? `Signed in as ${admin.email}` : undefined}
    >
      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={errorText(error)} onRetry={() => void refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.grid}>
            <StatTile
              label="Total Workers"
              value={String(data.totalWorkers)}
            />
            <StatTile label="Employers" value={String(data.employers)} />
            <StatTile label="Active Jobs" value={String(data.activeJobs)} />
            <StatTile
              label="Pending Verify"
              value={String(data.pendingVerification)}
              tone={data.pendingVerification > 0 ? 'warning' : 'default'}
            />
            <StatTile
              label="Total Revenue"
              value={data.totalRevenue === null ? '—' : `৳${data.totalRevenue}`}
            />
            <StatTile
              label="Monthly Rev"
              value={
                data.monthlyRevenue === null ? '—' : `৳${data.monthlyRevenue}`
              }
            />
            <StatTile label="Online Users" value={String(data.onlineUsers)} />
            <StatTile
              label="Fraud Alerts"
              value={String(data.fraudAlerts)}
              tone={data.fraudAlerts > 0 ? 'danger' : 'default'}
            />
          </View>

          <Text style={styles.sectionTitle}>Recent sign-ups</Text>
          <Card>
            {data.recentSignups.length === 0 ? (
              <Text style={styles.muted}>No accounts yet.</Text>
            ) : (
              data.recentSignups.map((u, i) => (
                <View
                  key={u.id}
                  style={[styles.row, i > 0 && styles.rowDivided]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{u.name}</Text>
                    <Text style={styles.rowMeta}>{u.phone}</Text>
                  </View>
                  <Badge
                    text={
                      u.verificationLevel >= 1
                        ? `Level ${u.verificationLevel}`
                        : 'Unverified'
                    }
                    tone={u.verificationLevel >= 1 ? 'success' : 'neutral'}
                  />
                </View>
              ))
            )}
          </Card>

          {/* Said plainly rather than shown as a confident zero — these
              modules are not built yet, and a reviewer should not read "0"
              as "no fraud today". */}
          <Text style={styles.note}>
            Revenue, jobs and fraud figures activate once those modules ship.
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: space.xxl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowText: { flex: 1 },
  rowName: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: font.sm },
  note: {
    fontSize: font.xs,
    color: colors.textFaint,
    marginTop: space.lg,
    lineHeight: 17,
  },
});
