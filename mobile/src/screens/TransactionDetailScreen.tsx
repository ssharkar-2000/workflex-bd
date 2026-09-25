import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { PaymentMethod, Transaction } from '../api/types';
import { BackButton, Button, Card, DetailRow, ErrorState, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, spacing, ThemeColors } from '../theme';
import { longDate, taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const PAYMENT_METHOD_LABEL_KEY: Partial<Record<PaymentMethod, string>> = {
  NAGAD: 'paymentMethod.nagad',
  ROCKET: 'paymentMethod.rocket',
  BANK_TRANSFER: 'paymentMethod.bankTransfer',
  CARD: 'paymentMethod.card',
  CASH: 'paymentMethod.cash',
};

const TRANSACTION_TYPE_KEY: Record<Transaction['type'], string> = {
  SALARY_PAYMENT: 'transactionType.salaryPayment',
  WITHDRAWAL: 'transactionType.withdrawal',
  PLATFORM_FEE: 'transactionType.platformFee',
  REFUND: 'transactionType.refund',
};

export function TransactionDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
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
            ? { amount: txn.amount, reason: t('transactionDetail.defaultRefundReason') }
            : undefined,
      });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('alertDetail.actionFailed'), friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.sm }]}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={text.screenTitle}>{t('transactionDetail.title')}</Text>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'head').bg }}>
        <View style={s.head}>
          <Text style={s.amount}>{taka(txn.amount)}</Text>
          <StatusPill value={txn.status} />
        </View>
        <View
          style={[s.typeBadge, { backgroundColor: categoryTint(categoryPalette, txn.type).bg }]}
        >
          <Text style={[s.typeBadgeText, { color: categoryTint(categoryPalette, txn.type).fg }]}>
            {t(TRANSACTION_TYPE_KEY[txn.type])}
          </Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'details').bg }}>
        <DetailRow label={t('transactionDetail.reference')} value={txn.code} />
        <DetailRow
          label={t('transactionDetail.method')}
          value={
            txn.method === 'BKASH'
              ? 'bKash'
              : PAYMENT_METHOD_LABEL_KEY[txn.method]
              ? t(PAYMENT_METHOD_LABEL_KEY[txn.method]!)
              : txn.method
          }
        />
        <DetailRow label={t('transactionDetail.from')} value={txn.fromLabel} />
        <DetailRow label={t('transactionDetail.to')} value={txn.toLabel} />
        <DetailRow label={t('transactionDetail.date')} value={longDate(txn.occurredAt)} />
        {txn.worker ? <DetailRow label={t('transactionDetail.worker')} value={`${txn.worker.fullName} · ${txn.worker.code}`} /> : null}
        {txn.refundReason ? <DetailRow label={t('transactionDetail.refundReason')} value={txn.refundReason} /> : null}
        {txn.relatedTransaction ? (
          <DetailRow label={t('transactionDetail.refundOf')} value={`${txn.relatedTransaction.code} (${taka(txn.relatedTransaction.amount)})`} />
        ) : null}
      </Card>

      {txn.refunds && txn.refunds.length > 0 ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: categoryTint(categoryPalette, 'refundHistory').bg }}>
          <Text style={s.label}>{t('transactionDetail.refundHistory')}</Text>
          {txn.refunds.map((r) => (
            <View key={r.id} style={s.refundRow}>
              <Text style={text.body}>{r.code}</Text>
              <Text style={text.body}>{taka(r.amount)}</Text>
              <StatusPill value={r.status} />
            </View>
          ))}
        </Card>
      ) : null}

      {txn.failureReason ? (
        <Card style={[s.failure, { marginTop: spacing.lg }]}>
          <Text style={s.failureTitle}>{t('transactionDetail.whyFailed')}</Text>
          <Text style={[text.body, { marginTop: spacing.xs }]}>{txn.failureReason}</Text>
        </Card>
      ) : null}

      <View style={s.actions}>
        {txn.status === 'FAILED' ? (
          <Button label={t('transactionDetail.retryPayment')} loading={busy} onPress={() => run('retry')} />
        ) : null}
        {txn.status === 'COMPLETED' && !(txn.refunds && txn.refunds.length > 0) ? (
          <Button label={t('transactionDetail.issueRefund')} variant="danger" loading={busy} onPress={() => run('refund')} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    amount: { fontSize: 26, fontWeight: '700', color: colors.textDark },
    typeBadge: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
    },
    typeBadgeText: { fontSize: 12, fontWeight: '700' },
    failure: { backgroundColor: colors.redBg },
    failureTitle: { ...text.label, color: colors.redText },
    actions: { marginTop: spacing.xl, gap: spacing.sm },
    label: { ...text.label, marginBottom: spacing.xs },
    refundRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
  });
}
