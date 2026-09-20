import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WALLET_LIMITS, formatTaka, type PaymentReceipt } from '@workflex/shared';
import { fetchPayees, fetchWallet, payHire } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import {
  Card,
  Field,
  MoneyInput,
  MoneyScreen,
  Notice,
  OutlineButton,
} from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { newRequestId } from '../../../src/lib/request-id';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * Paying someone you hired, for one job.
 *
 * Two steps on purpose. A payment cannot be undone — it lands in the other
 * person's wallet at once and can be withdrawn from there — so the amount is
 * read back, with the name, before anything moves.
 */
export default function PayScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { jobId, payeeId } = useLocalSearchParams<{ jobId?: string; payeeId?: string }>();

  const payees = useQuery({ queryKey: ['payees'], queryFn: fetchPayees });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });
  const payee = payees.data?.payees.find((p) => p.jobId === jobId && p.payeeId === payeeId);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  // One per visit: a retry after a dropped connection is the same payment.
  const [requestId] = useState(newRequestId);

  const balance = wallet.data?.balance ?? 0;
  const value = Number.parseInt(amount || '0', 10);
  const tooLittle = value < WALLET_LIMITS.paymentMin;
  const tooMuch = value > balance;

  const pay = useMutation({
    mutationFn: () =>
      payHire({ jobId: jobId!, payeeId: payeeId!, amount: value, note, requestId }),
    onSuccess: (done) => {
      setReceipt(done);
      for (const key of ['wallet', 'wallet-statement', 'payees', 'applicants']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err) => {
      setError(errorMessage(err));
      setConfirming(false);
    },
  });

  if (payees.isLoading || wallet.isLoading) {
    return (
      <MoneyScreen title={t('pay.title')}>
        <ActivityIndicator color={c.primary} style={styles.loading} />
      </MoneyScreen>
    );
  }

  if (receipt) {
    return (
      <MoneyScreen
        title={t('pay.title')}
        footer={<OutlineButton label={t('pay.done')} onPress={() => router.back()} />}
      >
        <Notice
          tone="success"
          title={`✓ ${t('pay.doneTitle', { amount: formatTaka(receipt.amount), name: receipt.payeeName })}`}
          body={t('pay.doneBody', { balance: formatTaka(receipt.balance) })}
        />
      </MoneyScreen>
    );
  }

  if (!payee) {
    return (
      <MoneyScreen title={t('pay.title')}>
        {payees.error ? (
          <ErrorBanner message={errorMessage(payees.error)} tone="onSurface" />
        ) : (
          <Notice tone="danger" body={t('pay.notHired')} />
        )}
      </MoneyScreen>
    );
  }

  const initials = payee.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <MoneyScreen
      title={t('pay.title')}
      footer={
        <View style={styles.footer}>
          {error ? <ErrorBanner message={error} tone="onSurface" /> : null}
          {confirming ? (
            <>
              <Notice
                tone="warning"
                title={t('pay.confirmTitle', { amount: formatTaka(value), name: payee.name })}
                body={t('pay.confirmBody')}
              />
              <View style={styles.confirmRow}>
                <View style={styles.flex}>
                  <OutlineButton
                    label={t('pay.back')}
                    onPress={() => setConfirming(false)}
                    disabled={pay.isPending}
                  />
                </View>
                <View style={styles.confirmPrimary}>
                  <ShimmerButton
                    label={t('pay.confirm')}
                    onPress={() => pay.mutate()}
                    loading={pay.isPending}
                  />
                </View>
              </View>
            </>
          ) : (
            <ShimmerButton
              label={value > 0 ? `${t('pay.review')} · ${formatTaka(value)}` : t('pay.review')}
              onPress={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={tooLittle || tooMuch}
            />
          )}
        </View>
      }
    >
      <Card style={styles.who}>
        <View style={[styles.avatar, { backgroundColor: c.tints[1], borderColor: c.tintBorders[1] }]}>
          <Text style={[styles.avatarText, { color: c.text }]}>{initials || '?'}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {payee.name}
          </Text>
          <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
            {t('pay.for', { job: payee.jobTitle })}
          </Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {t('pay.paidSoFar', { amount: formatTaka(payee.paidSoFar) })}
          </Text>
        </View>
      </Card>

      <Card>
        <MoneyInput
          label={t('pay.amount')}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setConfirming(false);
            if (error) setError(null);
          }}
          invalid={amount !== '' && (tooLittle || tooMuch)}
        />

        <View style={styles.balanceRow}>
          <Text style={[styles.meta, { color: tooMuch ? c.danger : c.textMuted }]}>
            {tooMuch ? t('pay.notEnough') : t('pay.inWallet', { amount: formatTaka(balance) })}
          </Text>
          {tooMuch || balance < WALLET_LIMITS.paymentMin ? (
            <Pressable
              onPress={() => router.push('/(app)/wallet/add-money')}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.addMoney, { color: c.primary }]}>
                ＋ {t('pay.addMoney')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {amount !== '' && tooLittle ? (
          <Text style={[styles.meta, { color: c.danger }]}>
            {t('pay.min', { amount: formatTaka(WALLET_LIMITS.paymentMin) })}
          </Text>
        ) : null}

        <View style={styles.noteGap} />
        <Field
          label={t('pay.note')}
          value={note}
          onChange={(v) => setNote(v.slice(0, 200))}
          placeholder={t('pay.notePlaceholder')}
          autoCapitalize="sentences"
          optional
        />
      </Card>
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.lg },
  flex: { flex: 1 },
  footer: { gap: 8 },
  confirmRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  confirmPrimary: { flex: 1.4 },

  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.md, fontWeight: '800' },
  name: { fontSize: font.lg, fontWeight: '800' },
  meta: { fontSize: font.xs + 1, marginTop: 2 },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  addMoney: { fontSize: font.sm, fontWeight: '800' },
  noteGap: { height: 14 },
});
