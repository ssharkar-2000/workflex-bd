import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { DashboardOverview } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { BrandMark, BrandWordmark } from '../components/Brand';
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
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { taka, timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const QUICK_ACCESS = [
  { labelKey: 'nav.workers', icon: '👷', route: 'Workers' },
  { labelKey: 'nav.jobs', icon: '💼', route: 'Jobs' },
  { labelKey: 'nav.payments', icon: '💳', route: 'Payments' },
  { labelKey: 'dashboard.quickVerify', icon: '✅', route: 'Verifications' },
  { labelKey: 'analytics.title', icon: '📊', route: 'Analytics' },
  { labelKey: 'dashboard.quickAiMonitor', icon: '🛡️', route: 'AIMonitoring' },
] as const;

export function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { admin } = useAuth();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
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
          <BrandMark size={32} />
          <BrandWordmark size={17} />
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
        <Text style={s.greeting}>
          {t('dashboard.hello', { name: admin?.displayName ?? t('dashboard.defaultAdminName') })}
        </Text>
      </View>

      {/* Critical alert banner */}
      {liveAlerts[0]?.severity === 'CRITICAL' ? (
        <Pressable onPress={() => navigation.navigate('AlertDetail', { id: liveAlerts[0].id })}>
          <View style={s.sosBanner}>
            <Text style={s.sosTitle}>{liveAlerts[0].message}</Text>
            <Text style={s.sosMeta}>
              {liveAlerts[0].subjectName} • {timeAgo(liveAlerts[0].detectedAt, t)}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Overview */}
      <SectionHeader title={t('dashboard.overview')} />
      <View style={s.statGrid}>
        <StatCard label={t('dashboard.totalWorkers')} value={overview.totalWorkers.toLocaleString('en-IN')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'totalWorkers').bg} />
        <StatCard label={t('dashboard.totalRevenue')} value={taka(overview.totalRevenue, true)} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'totalRevenue').bg} />
        <StatCard label={t('dashboard.employers')} value={overview.employers.toLocaleString('en-IN')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'employers').bg} />
        <StatCard label={t('dashboard.pendingVerify')} value={overview.pendingVerify.toLocaleString('en-IN')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'pendingVerify').bg} />
      </View>

      {/* Revenue */}
      {series.length > 0 ? (
        <Pressable onPress={() => navigation.navigate('Analytics')}>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={s.cardHead}>
              <View>
                <Text style={text.sectionTitle}>{t('dashboard.revenue')}</Text>
                <Text style={text.caption}>{t('dashboard.tapFullAnalytics')}</Text>
              </View>
            </View>
            <BarChart data={series} />
          </Card>
        </Pressable>
      ) : null}

      {/* Worker status */}
      <Card style={{ marginTop: spacing.lg }}>
        <SectionHeader
          title={t('dashboard.workerStatus')}
          actionLabel={t('dashboard.viewAllArrow')}
          onAction={() => navigation.navigate('Workers')}
        />
        <StatusBar label={t('common.verified')} percent={workerStatus.verified} color={colors.greenText} styles={s} text={text} />
        <StatusBar label={t('workers.pending')} percent={workerStatus.pending} color={colors.amber} styles={s} text={text} />
        <StatusBar label={t('reports.rejected')} percent={workerStatus.rejected} color={colors.red} styles={s} text={text} />
        <StatusBar label={t('workers.suspended')} percent={workerStatus.suspended} color={colors.slate} styles={s} text={text} />
      </Card>

      {/* Live alerts */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader
          title={t('dashboard.liveAlerts')}
          actionLabel={t('dashboard.allArrow')}
          onAction={() => navigation.navigate('AIMonitoring')}
        />
        {liveAlerts.map((alert) => (
          <Pressable
            key={alert.id}
            onPress={() => navigation.navigate('AlertDetail', { id: alert.id })}
          >
            <Card style={{ marginBottom: spacing.sm, backgroundColor: categoryTint(categoryPalette, alert.id).bg }}>
              <View style={s.alertRow}>
                <View style={s.flexShrink}>
                  <Text style={text.cardTitle} numberOfLines={2}>
                    {alert.message}
                  </Text>
                  <Text style={[text.caption, { marginTop: spacing.xs }]}>
                    {alert.subjectName} • {timeAgo(alert.detectedAt, t)}
                  </Text>
                </View>
                <StatusPill value={alert.severity} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      {/* Quick access */}
      <SectionHeader title={t('dashboard.quickAccess')} />
      <View style={s.quickGrid}>
        {QUICK_ACCESS.map((item) => (
          <Pressable
            key={item.labelKey}
            style={[s.quickTile, { backgroundColor: categoryTint(categoryPalette, item.labelKey).bg }]}
            onPress={() => navigation.navigate(item.route)}
          >
            <Text style={s.quickIcon}>{item.icon}</Text>
            <Text style={s.quickLabel}>{t(item.labelKey)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

type DashStyles = ReturnType<typeof createStyles>;
type DashText = ReturnType<typeof buildText>;

function StatCard({
  label,
  value,
  styles,
  text,
  shadow,
  tint,
}: {
  label: string;
  value: string;
  styles: DashStyles;
  text: DashText;
  shadow: { card: object };
  tint?: string;
}) {
  return (
    <View style={[styles.statCard, shadow.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function StatusBar({
  label,
  percent,
  color,
  styles,
  text,
}: {
  label: string;
  percent: number;
  color: string;
  styles: DashStyles;
  text: DashText;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.statusHead}>
        <Text style={text.body}>{label}</Text>
        <Text style={[text.label, { color }]}>{percent}%</Text>
      </View>
      <Meter percent={percent} color={color} />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: DashText) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
}
