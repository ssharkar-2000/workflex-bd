import React, { useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Transaction } from '../api/types';
import { Button, Card, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { colors, spacing, text } from '../theme';
import { humanise, longDate, taka } from '../theme/format';

export function TransactionDetailScreen({ route }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { data: txn, loading, error, refetch } = useApi<Transaction>(`/payments/transactions/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading && !txn) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!txn) return null;

  const run = async (action: 'refund' | 'retry') => {
    setBusy(true);
    try {
      await api(`/payments/transactions/${id}/${action}`, {
        method: 'POST',
        body:
          action === 'refund'
            ? { amount: txn.amount, reason: 'Refund issued by admin' }
            : undefined,
      });
      await refetch();
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <Text style={text.screenTitle}>Transaction Details</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={s.head}>
          <Text style={s.amount}>{taka(txn.amount)}</Text>
          <StatusPill value={txn.status} />
        </View>
        <Text style={text.caption}>{humanise(txn.type)}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="Reference" value={txn.code} />
        <DetailRow label="From" value={txn.fromLabel} />
        <DetailRow label="To" value={txn.toLabel} />
        <DetailRow label="Date" value={longDate(txn.occurredAt)} />
        {txn.worker ? <DetailRow label="Worker" value={`${txn.worker.fullName} · ${txn.worker.code}`} /> : null}
        {txn.refundReason ? <DetailRow label="Refund reason" value={txn.refundReason} /> : null}
      </Card>

      {txn.failureReason ? (
        <Card style={[s.failure, { marginTop: spacing.lg }]}>
          <Text style={s.failureTitle}>Why this failed</Text>
          <Text style={[text.body, { marginTop: spacing.xs }]}>{txn.failureReason}</Text>
        </Card>
      ) : null}

      <View style={s.actions}>
        {txn.status === 'FAILED' ? (
          <Button label="Retry payment" loading={busy} onPress={() => run('retry')} />
        ) : null}
        {txn.status === 'COMPLETED' ? (
          <Button label="Issue refund" variant="danger" loading={busy} onPress={() => run('refund')} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontSize: 26, fontWeight: '700', color: colors.textDark },
  failure: { backgroundColor: colors.redBg },
  failureTitle: { ...text.label, color: colors.redText },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
});
