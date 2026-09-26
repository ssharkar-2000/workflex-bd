import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WALLET_LIMITS,
  createWithdrawalSchema,
  formatTaka,
  isValidBdPhone,
  maskPhone,
  type CreateWithdrawalInput,
  type PayoutMethod,
  type Withdrawal,
} from '@workflex/shared';
import { fetchMe } from '../../../src/api/auth';
import { fetchWallet, requestWithdrawal } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import {
  Card,
  Chip,
  Field,
  Label,
  MoneyInput,
  MoneyScreen,
  Notice,
  OutlineButton,
  walletStyles,
} from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { newRequestId } from '../../../src/lib/request-id';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, space } from '../../../src/lib/theme';

const METHODS: PayoutMethod[] = ['BKASH', 'NAGAD', 'BANK'];

/** +8801712345678 as people write it: 01712345678. */
function localNumber(e164: string): string {
  return e164.startsWith('+880') ? `0${e164.slice(4)}` : e164;
}

/**
 * Taking earnings out.
 *
 * Only the earned part of the wallet can leave it (see Wallet.withdrawable
 * in the schema), and only to a verified person. The request takes the money
 * out of the wallet at once; a person on the WorkFlex team sends it and
 * records the transaction ID, which then shows on the wallet's history.
 */
export default function WithdrawScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const [method, setMethod] = useState<PayoutMethod>('BKASH');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Withdrawal | null>(null);
  // One per visit: a retry after a dropped connection is the same request.
  const [requestId] = useState(newRequestId);

  // Most people's bKash or Nagad is their own number, in their own name.
  // Filled in once, and never over something they have typed.
  useEffect(() => {
    const user = me.data;
    if (!user) return;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    setAccountName((v) => v || name);
    setAccountNumber((v) => v || localNumber(user.phone));
  }, [me.data]);

  const withdrawable = wallet.data?.withdrawable ?? 0;
  const value = Number.parseInt(amount || '0', 10);
  const methodName = (m: PayoutMethod) => t(`wallet.method.${m}` as TranslationKey);

  const submit = useMutation({
    mutationFn: requestWithdrawal,
    onSuccess: (withdrawal) => {
      setDone(withdrawal);
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const changeMethod = (next: PayoutMethod) => {
    // A phone number is not a bank account number, and the other way round.
    const wasBank = method === 'BANK';
    if (wasBank !== (next === 'BANK')) {
      setAccountNumber(next === 'BANK' ? '' : me.data ? localNumber(me.data.phone) : '');
    }
    setMethod(next);
    setError(null);
  };

  /** Checked here first, in the reader's language; the schema is the backstop. */
  const problem = (): string | null => {
    if (!accountName.trim() || accountName.trim().length < 2) return t('withdraw.nameNeeded');
    if (method === 'BANK') {
      if (bankName.trim().length < 2 || branchName.trim().length < 2) {
        return t('withdraw.bankNeeded');
      }
      if (!/^\d{6,20}$/.test(accountNumber.trim())) return t('withdraw.badAccount');
      if (routingNumber.trim() && !/^\d{9}$/.test(routingNumber.trim())) {
        return t('withdraw.badRouting');
      }
    } else if (!isValidBdPhone(accountNumber)) {
      return t('withdraw.badNumber', { method: methodName(method) });
    }
    if (value < WALLET_LIMITS.withdrawalMin) {
      return t('withdraw.min', { amount: formatTaka(WALLET_LIMITS.withdrawalMin) });
    }
    if (value > withdrawable) return t('withdraw.tooMuch', { amount: formatTaka(withdrawable) });
    return null;
  };

  const onSubmit = () => {
    const found = problem();
    if (found) {
      setError(found);
      return;
    }

    const input: CreateWithdrawalInput =
      method === 'BANK'
        ? {
            method,
            amount: value,
            accountName,
            accountNumber,
            bankName,
            branchName,
            routingNumber,
            requestId,
          }
        : { method, amount: value, accountName, accountNumber, requestId };

    const parsed = createWithdrawalSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('error.VALIDATION_FAILED'));
      return;
    }
    submit.mutate(input);
  };

  if (done) {
    const account =
      done.method === 'BANK'
        ? `${done.bankName ?? ''} •••• ${done.accountNumber.slice(-4)}`
        : `${methodName(done.method)} ${maskPhone(done.accountNumber)}`;
    return (
      <MoneyScreen
        title={t('withdraw.title')}
        footer={
          <OutlineButton label={t('withdraw.backToWallet')} onPress={() => router.back()} />
        }
      >
        <Notice
          tone="success"
          title={`✓ ${t('withdraw.doneTitle')}`}
          body={t('withdraw.doneBody', { amount: formatTaka(done.amount), account })}
        />
      </MoneyScreen>
    );
  }

  const canWithdraw = wallet.data?.canWithdraw !== false;

  return (
    <MoneyScreen
      title={t('withdraw.title')}
      subtitle={t('withdraw.subtitle')}
      footer={
        canWithdraw ? (
          <View style={styles.footer}>
            {error ? <ErrorBanner message={error} tone="onSurface" /> : null}
            <ShimmerButton
              label={
                value > 0
                  ? `${t('withdraw.submit')} · ${formatTaka(value)}`
                  : t('withdraw.submit')
              }
              onPress={onSubmit}
              loading={submit.isPending}
              disabled={withdrawable < WALLET_LIMITS.withdrawalMin || value <= 0}
            />
          </View>
        ) : undefined
      }
    >
      <Card>
        <Text style={[styles.availableLabel, { color: c.textMuted }]}>
          {t('withdraw.available')}
        </Text>
        <Text style={[styles.available, { color: c.text }]}>
          {wallet.data ? formatTaka(withdrawable) : '—'}
        </Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>{t('wallet.earnedHint')}</Text>
      </Card>

      {!canWithdraw ? (
        <Notice tone="warning" title={t('withdraw.gateTitle')} body={t('withdraw.gateBody')}>
          <View style={styles.gateCta}>
            <OutlineButton
              label={t('withdraw.gateCta')}
              onPress={() => router.push('/(onboarding)/documents')}
            />
          </View>
        </Notice>
      ) : wallet.data && withdrawable < WALLET_LIMITS.withdrawalMin ? (
        <Notice tone="info" body={t('withdraw.nothing')} />
      ) : (
        <>
          <Card>
            <Label text={t('withdraw.sendTo')} />
            <View style={[walletStyles.chips, styles.methods]}>
              {METHODS.map((m) => (
                <Chip
                  key={m}
                  label={methodName(m)}
                  on={method === m}
                  onPress={() => changeMethod(m)}
                />
              ))}
            </View>

            {method === 'BANK' ? (
              <>
                <Field
                  label={t('withdraw.bankName')}
                  value={bankName}
                  onChange={setBankName}
                  placeholder={t('withdraw.bankPlaceholder')}
                />
                <Field label={t('withdraw.branch')} value={branchName} onChange={setBranchName} />
                <Field
                  label={t('withdraw.accountName')}
                  value={accountName}
                  onChange={setAccountName}
                />
                <Field
                  label={t('withdraw.accountNumber')}
                  value={accountNumber}
                  onChange={(v) => setAccountNumber(v.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <Field
                  label={t('withdraw.routing')}
                  value={routingNumber}
                  onChange={(v) => setRoutingNumber(v.replace(/[^\d]/g, '').slice(0, 9))}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  optional
                />
              </>
            ) : (
              <>
                <Field
                  label={t('withdraw.mfsNumber', { method: methodName(method) })}
                  value={accountNumber}
                  onChange={setAccountNumber}
                  placeholder="01XXXXXXXXX"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <Field
                  label={t('withdraw.accountName')}
                  value={accountName}
                  onChange={setAccountName}
                />
              </>
            )}
          </Card>

          <Card>
            <MoneyInput
              label={t('withdraw.amount')}
              value={amount}
              onChange={(v) => {
                setAmount(v);
                if (error) setError(null);
              }}
              invalid={value > withdrawable}
            />
            <View style={walletStyles.chips}>
              <Chip
                label={t('withdraw.all', { amount: formatTaka(withdrawable) })}
                on={value === withdrawable && withdrawable > 0}
                onPress={() => setAmount(String(withdrawable))}
              />
            </View>
          </Card>

          <Notice tone="info" body={t('withdraw.howSent')} />
        </>
      )}
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
  availableLabel: { fontSize: font.sm, fontWeight: '700' },
  available: { fontSize: font.xl, fontWeight: '800', marginTop: 2 },
  hint: { fontSize: font.xs, lineHeight: 17, marginTop: 8 },
  methods: { marginBottom: space.md },
  gateCta: { marginTop: 12 },
});
