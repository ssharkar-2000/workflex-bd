import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Transaction, WorkerTransactionsPage } from '../api/types';
import { ErrorState, Loading, SectionHeader, StatusPill } from '../components';
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

/**
 * Full "1st to last" transaction history for one worker, reached from the
 * Worker Profile screen — who paid them, for which job, and a cash-in vs
 * cash-out picture (the profile screen only ever showed `totalEarnings`,
 * never the worker's actual wallet balance or a real transaction list).
 */
export function WorkerTransactionsScreen({ route, navigation }: any) {
  const { id, fullName, balance } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');

  const { data, loading, error, refetch } = useApi<WorkerTransactionsPage>(
    `/workers/${id}/transactions?limit=100&sort=${sort}`,
    [id, sort],
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
            <Pressable onPress={() => navigation.goBack()} style={s.backRow}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={text.caption}>{fullName}</Text>
            </Pressable>
            <Text style={text.screenTitle}>{t('workerTransactions.title')}</Text>

            <View style={[s.balanceCard, shadow.card, { backgroundColor: categoryTint(categoryPalette, 'balance').bg }]}>
              <Text style={[text.caption, { color: categoryTint(categoryPalette, 'balance').fg }]}>
                {t('workerTransactions.balance')}
              </Text>
              <Text style={[s.balanceValue, { color: categoryTint(categoryPalette, 'balance').fg }]}>
                {taka(balance ?? 0)}
              </Text>
            </View>

            {data?.last30Days ? (
              <View style={s.grid}>
                <View style={[s.summaryCard, shadow.card]}>
                  <Text style={[s.summaryValue, { color: colors.greenText }]}>
                    +{taka(data.last30Days.cashIn)}
                  </Text>
                  <Text style={text.caption}>{t('workerTransactions.cashIn')}</Text>
                  <Text style={text.micro}>{t('workerTransactions.last30Days')}</Text>
                </View>
                <View style={[s.summaryCard, shadow.card]}>
                  <Text style={[s.summaryValue, { color: colors.redText }]}>
                    -{taka(data.last30Days.cashOut)}
                  </Text>
                  <Text style={text.caption}>{t('workerTransactions.cashOut')}</Text>
                  <Text style={text.micro}>{t('workerTransactions.last30Days')}</Text>
                </View>
              </View>
            ) : null}

            <View style={s.sortRow}>
              <SectionHeader title={t('payments.transactions')} />
              <Pressable onPress={() => setSort((v) => (v === 'desc' ? 'asc' : 'desc'))} style={s.sortToggle}>
                <Text style={s.sortToggleText}>
                  {sort === 'desc' ? t('workerTransactions.newestFirst') : t('workerTransactions.oldestFirst')}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <Text style={[text.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              {t('workerTransactions.empty')}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('TransactionDetail', { id: item.id })}
            style={({ pressed }) => [s.txn, shadow.card, pressed && { opacity: 0.9 }]}
          >
            <View style={s.txnHead}>
              <Text style={s.txnCode}>{item.code}</Text>
              <StatusPill value={item.status} />
            </View>
            <View style={s.txnBody}>
              <View style={[s.typeBadge, { backgroundColor: categoryTint(categoryPalette, item.type).bg }]}>
                <Text style={[s.typeBadgeText, { color: categoryTint(categoryPalette, item.type).fg }]}>
                  {t(TRANSACTION_TYPE_KEY[item.type])}
                </Text>
              </View>
              <Text style={[s.amount, item.direction === 'IN' ? { color: colors.greenText } : { color: colors.redText }]}>
                {item.direction === 'IN' ? '+' : '-'}
                {taka(item.amount)}
              </Text>
            </View>
            {item.job ? (
              <Text style={text.micro} numberOfLines={1}>
                {t('workerTransactions.forJob')}: {item.job.title} ({item.job.code})
              </Text>
            ) : null}
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

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
    backArrow: { fontSize: 20, color: colors.textGray },
    balanceCard: { borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.lg },
    balanceValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
    grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    summaryCard: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },
    summaryValue: { fontSize: 16, fontWeight: '800' },
    sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl },
    sortToggle: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    sortToggleText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    txn: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
    txnHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    txnCode: { fontSize: 13, fontWeight: '700', color: colors.textDark },
    txnBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
    typeBadgeText: { fontSize: 12, fontWeight: '700' },
    amount: { fontSize: 15, fontWeight: '700' },
    txnFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
  });
}
