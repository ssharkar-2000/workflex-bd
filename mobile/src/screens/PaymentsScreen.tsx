import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page, PaymentsSummary, Transaction } from '../api/types';
import { ErrorState, Loading, SectionHeader, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { humanise, longDate, taka } from '../theme/format';

export function PaymentsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const summary = useApi<PaymentsSummary>('/payments/summary');
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
            <Text style={text.screenTitle}>Payments</Text>

            {summary.data ? (
              <View style={s.grid}>
                <SummaryCard label="Total Revenue" value={taka(summary.data.totalRevenue, true)} />
                <SummaryCard label="Monthly Revenue" value={taka(summary.data.monthlyRevenue, true)} />
                <SummaryCard label="Wallet Balance" value={taka(summary.data.walletBalance, true)} />
                <SummaryCard label="Pending Payouts" value={taka(summary.data.pendingPayouts, true)} />
              </View>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Transactions" />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? <ErrorState message={error} onRetry={refetch} /> : loading ? <Loading /> : null
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
              <Text style={text.body}>{humanise(item.type)}</Text>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.summaryCard, shadow.card]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  amount: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  txnFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
