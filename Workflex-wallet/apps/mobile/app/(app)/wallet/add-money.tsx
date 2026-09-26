import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WALLET_LIMITS,
  formatTaka,
  type PayoutMethod,
} from '@workflex/shared';
import { declareDeposit, fetchDepositAccounts } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import {
  Card,
  Chip,
  Field,
  MoneyInput,
  MoneyScreen,
  Notice,
} from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/** Round sums people actually add, so most never need the keyboard. */
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

/** A new id per declaration, so a double tap does not declare twice. */
function newRequestId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : // Expo Go on older Android has no randomUUID; this only has to be
      // unique among this account's own declarations.
      `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/**
 * Adding money, without a payment gateway.
 *
 * The person sends money themselves, in their own bKash, Nagad or bank app,
 * to the account shown here. Then they declare it: how much, from which
 * number, and the transaction id their app gave them. Nothing is credited on
 * that alone — it waits until someone has found the money on the receiving
 * account — so the screen says so plainly rather than implying the balance
 * is about to change.
 */
export default function AddMoneyScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const accounts = useQuery({
    queryKey: ['deposit-accounts'],
    queryFn: fetchDepositAccounts,
  });

  const available = accounts.data?.accounts ?? [];
  const [method, setMethod] = useState<PayoutMethod | null>(null);
  const chosen = useMemo(
    () => available.find((a) => a.method === (method ?? available[0]?.method)) ?? null,
    [available, method],
  );

  const [amount, setAmount] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState(false);

  const value = Number.parseInt(amount || '0', 10);
  const inRange = value >= WALLET_LIMITS.topUpMin && value <= WALLET_LIMITS.topUpMax;
  const complete = Boolean(chosen) && inRange && senderAccount.trim().length >= 6 && reference.trim().length >= 4;

  const declare = useMutation({
    mutationFn: () =>
      declareDeposit({
        amount: value,
        method: chosen!.method,
        senderAccount: senderAccount.trim(),
        reference: reference.trim(),
        requestId: newRequestId(),
      }),
    onSuccess: (deposit) => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
      void queryClient.invalidateQueries({ queryKey: ['deposits'] });
      // Credited already where development approves on sight; otherwise it is
      // waiting, and the wallet screen lists it as such.
      router.replace(deposit.status === 'PAID' ? '/(app)/wallet' : '/(app)/wallet/deposits');
    },
  });

  const copyAccount = async () => {
    if (!chosen) return;
    await Clipboard.setStringAsync(chosen.account);
    setCopied(true);
  };

  return (
    <MoneyScreen
      title={t('addMoney.title')}
      subtitle={t('addMoney.subtitle')}
      footer={
        <ShimmerButton
          label={t('addMoney.declare')}
          onPress={() => declare.mutate()}
          disabled={!complete || declare.isPending}
          loading={declare.isPending}
        />
      }
    >
      {accounts.isLoading ? null : available.length === 0 ? (
        <Notice tone="warning" body={t('addMoney.noAccounts')} />
      ) : (
        <>
          {/* 1 — where to send it */}
          <Text style={[styles.step, { color: c.textMuted }]}>{t('addMoney.step1')}</Text>

          <View style={styles.methods}>
            {available.map((account) => (
              <Chip
                key={account.method}
                label={t(`wallet.method.${account.method}` as never)}
                on={chosen?.method === account.method}
                onPress={() => setMethod(account.method)}
              />
            ))}
          </View>

          {chosen ? (
            <Card style={styles.account}>
              <Text style={[styles.accountLabel, { color: c.textMuted }]}>
                {t('addMoney.sendTo', { method: t(`wallet.method.${chosen.method}` as never) })}
              </Text>
              <Text style={[styles.accountNumber, { color: c.text }]} selectable>
                {chosen.account}
              </Text>
              <Text style={[styles.accountName, { color: c.textMuted }]}>
                {chosen.accountName}
                {chosen.howTo ? ` · ${chosen.howTo}` : ''}
              </Text>

              <Pressable
                onPress={copyAccount}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.copy,
                  { borderColor: c.primarySoftBorder, backgroundColor: pressed ? c.primarySoft : 'transparent' },
                ]}
              >
                <Text style={[styles.copyText, { color: c.primary }]}>
                  {copied ? t('addMoney.copied') : t('addMoney.copy')}
                </Text>
              </Pressable>
            </Card>
          ) : null}

          {/* 2 — what you sent */}
          <Text style={[styles.step, { color: c.textMuted }]}>{t('addMoney.step2')}</Text>

          <MoneyInput label={t('addMoney.amount')} value={amount} onChange={setAmount} />

          <View style={styles.quick}>
            {QUICK_AMOUNTS.map((quick) => (
              <Chip
                key={quick}
                label={formatTaka(quick)}
                on={value === quick}
                onPress={() => setAmount(String(quick))}
              />
            ))}
          </View>

          <Field
            label={t('addMoney.senderAccount')}
            value={senderAccount}
            onChange={setSenderAccount}
            placeholder="01XXXXXXXXX"
            keyboardType="phone-pad"
          />
          <Field
            label={t('addMoney.reference')}
            value={reference}
            onChange={setReference}
            placeholder="TRX12AB34CD"
            autoCapitalize="none"
          />

          <Notice tone="info" body={t('addMoney.waitsForReview')} />

          {declare.error ? (
            <ErrorBanner message={errorMessage(declare.error)} tone="onSurface" />
          ) : null}

          <Text style={[styles.limits, { color: c.textMuted }]}>
            {t('addMoney.limits', {
              min: formatTaka(WALLET_LIMITS.topUpMin),
              max: formatTaka(WALLET_LIMITS.topUpMax),
            })}
          </Text>
        </>
      )}

      {accounts.error ? (
        <ErrorBanner message={errorMessage(accounts.error)} tone="onSurface" />
      ) : null}
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4, marginTop: space.lg },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  account: { marginTop: space.md, gap: 2 },
  accountLabel: { fontSize: font.xs, fontWeight: '700' },
  accountNumber: { fontSize: font.xl, fontWeight: '800', letterSpacing: 0.5 },
  accountName: { fontSize: font.sm },
  copy: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  copyText: { fontSize: font.sm, fontWeight: '800' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  limits: { fontSize: font.xs, lineHeight: 17, marginTop: space.sm },
});
