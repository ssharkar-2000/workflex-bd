import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { DashboardOverview } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import {
  Avatar,
  BarChart,
  Card,
  ErrorState,
  Loading,
  Meter,
  SectionHeader,
  StatusPill,
} from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { taka, timeAgo } from '../theme/format';

const QUICK_ACCESS = [
  { label: 'Workers', icon: '👷', route: 'Workers' },
  { label: 'Jobs', icon: '💼', route: 'Jobs' },
  { label: 'Payments', icon: '💳', route: 'Payments' },
  { label: 'Verify', icon: '✅', route: 'Verifications' },
  { label: 'Analytics', icon: '📊', route: 'Analytics' },
  { label: 'AI Monitor', icon: '🛡️', route: 'AIMonitoring' },
] as const;

export function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { admin } = useAuth();
  const { data, loading, error, refetch } = useApi<DashboardOverview>('/dashboard');
  const analytics = useApi<{ revenueSeries: { month: string; total: number }[] }>(
    '/dashboard/analytics',
  );

  // 🟢 ১. প্রথমবার রেন্ডার হওয়ার সময় ডাটা না থাকলে লোডার দেখাবে
  if (loading && !data) return <Loading />;

  // 🟢 ২. ডাটা না থাকলে নিরাপদ ব্যাকআপ ডিফল্ট অবজেক্ট বসানো যাতে ক্র্যাশ না করে
  const overview = data?.overview ?? { totalWorkers: 0, totalRevenue: 0, employers: 0, pendingVerify: 0 };
  const workerStatus = data?.workerStatus ?? { verified: 0, pending: 0, rejected: 0, suspended: 0 };
  const liveAlerts = data?.liveAlerts ?? [];
  const notifications = data?.notifications ?? { unread: 0 };

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const series = (analytics.data?.revenueSeries ?? []).slice(-6).map((point) => ({
    label: new Date(`${point.month}-01`).toLocaleDateString('en-GB', { month: 'short' }),
    value: point.total,
  }));

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={s.topBar}>
        <View style={s.brand}>
          <View style={s.logoIcon}>
            <Text style={s.logoMark}>⚡</Text>
          </View>
          <Text style={s.brandName}>WorkFlex BD</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
          <View>
            <Text style={s.bell}>🔔</Text>
            {notifications.unread > 0 ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{notifications.unread}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>

      <View style={s.welcome}>
        <Text style={text.caption}>{today}</Text>
        <Text style={s.greeting}>Hello, {admin?.displayName ?? 'Admin'}</Text>
      </View>

      {/* Critical alert banner */}
      {liveAlerts[0]?.severity === 'CRITICAL' ? (
        <Pressable onPress={() => navigation.navigate('AlertDetail', { id: liveAlerts[0].id })}>
          <View style={s.sosBanner}>
            <Text style={s.sosTitle}>{liveAlerts[0].message}</Text>
            <Text style={s.sosMeta}>
              {liveAlerts[0].subjectName} • {timeAgo(liveAlerts[0].detectedAt)}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Overview */}
      <SectionHeader title="Overview" />
      <View style={s.statGrid}>
        <StatCard label="Total Workers" value={overview.totalWorkers.toLocaleString('en-IN')} />
        <StatCard label="Total Revenue" value={taka(overview.totalRevenue, true)} />
        <StatCard label="Employers" value={overview.employers.toLocaleString('en-IN')} />
        <StatCard label="Pending Verify" value={overview.pendingVerify.toLocaleString('en-IN')} />
      </View>

      {/* Revenue */}
      {series.length > 0 ? (
        <Pressable onPress={() => navigation.navigate('Analytics')}>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={s.cardHead}>
              <View>
                <Text style={text.sectionTitle}>Revenue</Text>
                <Text style={text.caption}>Tap for full analytics</Text>
              </View>
            </View>
            <BarChart data={series} />
          </Card>
        </Pressable>
      ) : null}

      {/* Worker status */}
      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader
          title="Worker Status"
          actionLabel="View all ›"
          onAction={() => navigation.navigate('Workers')}
        />
        <StatusBar label="Verified" percent={workerStatus.verified} color={colors.greenText} />
        <StatusBar label="Pending" percent={workerStatus.pending} color={colors.amber} />
        <StatusBar label="Rejected" percent={workerStatus.rejected} color={colors.red} />
        <StatusBar label="Suspended" percent={workerStatus.suspended} color={colors.slate} />
      </Card>

      {/* Live alerts */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader
          title="Live Alerts"
          actionLabel="All ›"
          onAction={() => navigation.navigate('AIMonitoring')}
        />
        {liveAlerts.map((alert) => (
          <Pressable
            key={alert.id}
            onPress={() => navigation.navigate('AlertDetail', { id: alert.id })}
          >
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={s.alertRow}>
                <View style={s.flexShrink}>
                  <Text style={text.cardTitle} numberOfLines={2}>
                    {alert.message}
                  </Text>
                  <Text style={[text.caption, { marginTop: spacing.xs }]}>
                    {alert.subjectName} • {timeAgo(alert.detectedAt)}
                  </Text>
                </View>
                <StatusPill value={alert.severity} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      {/* Quick access */}
      <SectionHeader title="Quick Access" />
      <View style={s.quickGrid}>
        {QUICK_ACCESS.map((item) => (
          <Pressable
            key={item.label}
            style={s.quickTile}
            onPress={() => navigation.navigate(item.route)}
          >
            <Text style={s.quickIcon}>{item.icon}</Text>
            <Text style={s.quickLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.statCard, shadow.card]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function StatusBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={s.statusHead}>
        <Text style={text.body}>{label}</Text>
        <Text style={[text.label, { color }]}>{percent}%</Text>
      </View>
      <Meter percent={percent} color={color} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { fontSize: 14 },
  brandName: { fontSize: 17, fontWeight: '700', color: colors.textDark },
  bell: { fontSize: 18 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  welcome: { marginTop: spacing.lg, marginBottom: spacing.lg },
  greeting: { ...text.screenTitle, marginTop: 2 },

  sosBanner: {
    backgroundColor: colors.red,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sosTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sosMeta: { color: '#FEE2E2', fontSize: 12, marginTop: 2 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },

  cardHead: { marginBottom: spacing.lg },
  statusHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },

  alertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flexShrink: { flex: 1 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickTile: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickIcon: { fontSize: 22 },
  quickLabel: { ...text.caption, fontWeight: '600', color: colors.textDark },
});