import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { PaymentMethod } from '../api/types';
import { BackButton, BarChart, Card, ErrorState, Loading, SectionHeader } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const PAYMENT_METHOD_LABEL_KEY: Partial<Record<PaymentMethod, string>> = {
  NAGAD: 'paymentMethod.nagad',
  ROCKET: 'paymentMethod.rocket',
  BANK_TRANSFER: 'paymentMethod.bankTransfer',
  CARD: 'paymentMethod.card',
  CASH: 'paymentMethod.cash',
};

type Analytics = {
  revenueSeries: { month: string; total: number }[];
  workerSeries: { month: string; total: number }[];
  platformRating: number;
  reviewCount: number;
  jobFillRate: number;
  avgHireDays: number;
  payments: {
    byStatus: { status: string; total: number; count: number }[];
    byMethod: { method: string; total: number; count: number }[];
    refunds: { total: number; count: number };
  };
};

type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

export function AnalyticsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
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
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('analytics.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'revenue').bg }}>
        <SectionHeader title={t('payments.totalRevenue')} />
        <Text style={[text.caption, { marginBottom: spacing.lg }]}>
          {t('analytics.last6Months', { total: taka(revenue.reduce((sum, p) => sum + p.value, 0), true) })}
        </Text>
        <BarChart data={revenue} />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'workerGrowth').bg }}>
        <SectionHeader title={t('analytics.workerGrowth')} />
        <Text style={[text.caption, { marginBottom: spacing.lg }]}>{t('analytics.activeWorkersByMonth')}</Text>
        <BarChart data={workers} />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'paymentsBreakdown').bg }}>
        <SectionHeader title={t('analytics.paymentsBreakdown')} />
        {data.payments.byStatus.map((row) => (
          <View key={row.status} style={s.breakdownRow}>
            <Text style={text.body}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</Text>
            <Text style={text.body}>
              {taka(row.total, true)} · {t('analytics.txns', { count: row.count })}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'paymentsByMethod').bg }}>
        <SectionHeader title={t('analytics.paymentsByMethod')} />
        {data.payments.byMethod.length === 0 ? (
          <Text style={text.caption}>{t('analytics.noPaymentsYet')}</Text>
        ) : (
          data.payments.byMethod.map((row) => (
            <View key={row.method} style={s.breakdownRow}>
              <Text style={text.body}>
                {row.method === 'BKASH'
                  ? 'bKash'
                  : PAYMENT_METHOD_LABEL_KEY[row.method]
                  ? t(PAYMENT_METHOD_LABEL_KEY[row.method]!)
                  : row.method}
              </Text>
              <Text style={text.body}>
                {taka(row.total, true)} · {t('analytics.txns', { count: row.count })}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card style={[{ marginTop: spacing.lg }, s.refundCard]}>
        <SectionHeader title={t('analytics.refunds')} />
        <Text style={s.refundAmount}>{taka(data.payments.refunds.total, true)}</Text>
        <Text style={text.caption}>{t('analytics.refundsIssued', { count: data.payments.refunds.count })}</Text>
      </Card>

      <View style={s.grid}>
        <KpiTile
          value={`${data.platformRating.toFixed(1)}/5.0`}
          label={t('analytics.platformRating')}
          hint={t('analytics.reviewsCount', { count: data.reviewCount.toLocaleString('en-IN') })}
          styles={s}
          text={text}
          shadow={shadow}
          tint={categoryTint(categoryPalette, 'platformRating').bg}
        />
        <KpiTile value={`${data.jobFillRate}%`} label={t('analytics.jobFillRate')} hint={t('analytics.approvedVsTotal')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'jobFillRate').bg} />
        <KpiTile value={t('analytics.days', { count: data.avgHireDays })} label={t('analytics.avgHireTime')} hint={t('analytics.applyToOffer')} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'avgHireDays').bg} />
        <KpiTile
          value={workers.length ? workers[workers.length - 1].value.toLocaleString('en-IN') : '—'}
          label={t('analytics.activeWorkers')}
          hint={t('analytics.latestMonth')}
          styles={s}
          text={text}
          shadow={shadow}
          tint={categoryTint(categoryPalette, 'activeWorkers').bg}
        />
      </View>
    </ScrollView>
  );
}

function KpiTile({
  value,
  label,
  hint,
  styles,
  text,
  shadow,
  tint,
}: {
  value: string;
  label: string;
  hint: string;
  styles: Styles;
  text: Txt;
  shadow: { card: object };
  tint?: string;
}) {
  return (
    <View style={[styles.tile, shadow.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.label, { marginTop: 2 }]}>{label}</Text>
      <Text style={text.micro}>{hint}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
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
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    refundCard: { backgroundColor: colors.redBg },
    refundAmount: { fontSize: 24, fontWeight: '700', color: colors.redText, marginTop: spacing.xs },
  });
}
