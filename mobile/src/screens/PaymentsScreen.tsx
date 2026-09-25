import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page, PaymentsSummary, Transaction } from '../api/types';
import { BarChart, Card, ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate, taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

const TRANSACTION_TYPE_KEY: Record<Transaction['type'], string> = {
  SALARY_PAYMENT: 'transactionType.salaryPayment',
  WITHDRAWAL: 'transactionType.withdrawal',
  PLATFORM_FEE: 'transactionType.platformFee',
  REFUND: 'transactionType.refund',
};

export function PaymentsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const summary = useApi<PaymentsSummary>('/payments/summary');
  const revenueSeries = useApi<{ month: string; total: number }[]>('/payments/revenue-series');
  const { data, loading, error, refetch } = useApi<Page<Transaction>>('/payments/transactions');

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
            <Text style={text.screenTitle}>{t('payments.title')}</Text>

            {summary.data ? (
              <View style={s.grid}>
                <SummaryCard label={t('payments.totalRevenue')} value={taka(summary.data.totalRevenue, true)} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'totalRevenue').bg} />
                <SummaryCard label={t('payments.monthlyRevenue')} value={taka(summary.data.monthlyRevenue, true)} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'monthlyRevenue').bg} />
                <SummaryCard label={t('payments.walletBalance')} value={taka(summary.data.walletBalance, true)} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'walletBalance').bg} />
                <SummaryCard label={t('payments.pendingPayouts')} value={taka(summary.data.pendingPayouts, true)} styles={s} text={text} shadow={shadow} tint={categoryTint(categoryPalette, 'pendingPayouts').bg} />
              </View>
            ) : null}

            <Pressable style={s.analyticsLink} onPress={() => navigation.navigate('Analytics')}>
              <Text style={s.analyticsLinkText}>{t('payments.fullAnalytics')}</Text>
              <Text style={s.analyticsLinkArrow}>›</Text>
            </Pressable>

            {revenueSeries.data && revenueSeries.data.length > 0 ? (
              <Card style={{ marginTop: spacing.lg }}>
                <SectionHeader title={t('payments.revenueTrend')} />
                <Text style={[text.caption, { marginBottom: spacing.lg }]}>
                  {t('payments.revenueTrendHint')}
                </Text>
                <BarChart
                  data={revenueSeries.data.map((p) => ({
                    label: new Date(`${p.month}-01`).toLocaleDateString('en-GB', { month: 'short' }),
                    value: p.total,
                  }))}
                />
              </Card>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title={t('payments.transactions')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? <ErrorState message={error} onRetry={refetch} /> : loading ? <Loading /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('TransactionDetail', { id: item.id })}
            style={({ pressed }) => [s.txn, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }, pressed && { opacity: 0.9 }]}
          >
            <View style={s.txnHead}>
              <Text style={s.txnCode}>{item.code}</Text>
              <StatusPill value={item.status} />
            </View>
            <View style={s.txnBody}>
              <View
                style={[s.typeBadge, { backgroundColor: categoryTint(categoryPalette, item.type).bg }]}
              >
                <Text style={[s.typeBadgeText, { color: categoryTint(categoryPalette, item.type).fg }]}>
                  {t(TRANSACTION_TYPE_KEY[item.type])}
                </Text>
              </View>
              <Text style={s.amount}>{taka(item.amount)}</Text>
            </View>
            <View style={s.txnFoot}>
              <Text style={text.micro} numberOfLines={1}>
                {item.fromLabel} → {item.toLabel}
              </Text>
              <Text style={text.micro}>{longDate(item.occurredAt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function SummaryCard({
  label,
  value,
  styles,
  text,
  shadow,
  tint,
}: {
  label: string;
  value: string;
  styles: Styles;
  text: Txt;
  shadow: { card: object };
  tint?: string;
}) {
  return (
    <View style={[styles.summaryCard, shadow.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
    summaryCard: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    txn: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
    txnHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    txnCode: { fontSize: 13, fontWeight: '700', color: colors.textDark },
    txnBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
    typeBadgeText: { fontSize: 12, fontWeight: '700' },
    amount: { fontSize: 15, fontWeight: '700', color: colors.textDark },
    txnFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    analyticsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primarySoft,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.lg,
    },
    analyticsLinkText: { ...text.label, color: colors.primary },
    analyticsLinkArrow: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  });
}
