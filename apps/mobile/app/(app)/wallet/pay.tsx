import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WALLET_LIMITS, formatTaka } from '@workflex/shared';
import { fetchWallet, payForJob, payHire } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import {
  Field,
  MoneyInput,
  MoneyScreen,
  Notice,
} from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, space } from '../../../src/lib/theme';

function newRequestId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/**
 * Paying someone for a job, typed out by hand.
 *
 * Three identifiers, all required: who they are (their WorkFlex id), the
 * number that must belong to that same account, and which job the money is
 * for. The server checks that all three agree before it moves anything —
 * one of them alone is a single typo away from paying a stranger.
 *
 * Opened from the hired list or an applicant card, the person is already
 * known — the app passes their account id, the hire is already on record,
 * and the screen asks only for an amount. Opened from the wallet, nothing is
 * known and all three identifiers are typed.
 */
export default function PayScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const params = useLocalSearchParams<{
    jobId?: string;
    payeeId?: string;
    publicId?: string;
    phone?: string;
  }>();
  // Came from a list that already knows who is being paid, so the three
  // identifying fields would be asking the app's own question back at it.
  const known = Boolean(params.payeeId && params.jobId);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });

  const [publicId, setPublicId] = useState(params.publicId ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [jobId, setJobId] = useState(params.jobId ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const value = Number.parseInt(amount || '0', 10);
  const inRange =
    value >= WALLET_LIMITS.paymentMin && value <= WALLET_LIMITS.transferMax;
  const enough = (wallet.data?.balance ?? 0) >= value;
  const complete = known
    ? inRange
    : publicId.trim().length >= 4 &&
      phone.trim().length >= 6 &&
      jobId.trim().length > 0 &&
      inRange;

  const pay = useMutation({
    mutationFn: () =>
      known
        ? payHire({
            jobId: params.jobId!,
            payeeId: params.payeeId!,
            amount: value,
            note: note.trim() || undefined,
            requestId: newRequestId(),
          })
        : payForJob({
            publicId: publicId.trim(),
            phone: phone.trim(),
            jobId: jobId.trim(),
            amount: value,
            note: note.trim() || undefined,
            requestId: newRequestId(),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
      router.replace('/(app)/wallet');
    },
  });

  return (
    <MoneyScreen
      title={t('pay.title')}
      subtitle={t('pay.subtitle')}
      footer={
        <ShimmerButton
          label={t('pay.send', { amount: inRange ? formatTaka(value) : '' })}
          onPress={() => pay.mutate()}
          disabled={!complete || !enough || pay.isPending}
          loading={pay.isPending}
        />
      }
    >
      <Text style={[styles.available, { color: c.textMuted }]}>
        {t('pay.available', { amount: formatTaka(wallet.data?.balance ?? 0) })}
      </Text>

      {known ? null : (
        <>
          <Field
            label={t('pay.publicId')}
            value={publicId}
            onChange={setPublicId}
            placeholder="WF-3A9C1B"
            autoCapitalize="none"
          />
          <Field
            label={t('pay.phone')}
            value={phone}
            onChange={setPhone}
            placeholder="01XXXXXXXXX"
            keyboardType="phone-pad"
          />
          <Field
            label={t('pay.jobId')}
            value={jobId}
            onChange={setJobId}
            placeholder={t('pay.jobIdPlaceholder')}
            autoCapitalize="none"
          />
        </>
      )}

      <MoneyInput label={t('addMoney.amount')} value={amount} onChange={setAmount} />

      <Field
        label={t('scan.note')}
        value={note}
        onChange={setNote}
        placeholder={t('pay.notePlaceholder')}
        optional
        autoCapitalize="sentences"
      />

      {!enough && inRange ? (
        <View style={styles.spacer}>
          <Notice tone="warning" body={t('pay.notEnough')} />
        </View>
      ) : null}

      {pay.error ? (
        <ErrorBanner message={errorMessage(pay.error)} tone="onSurface" />
      ) : null}

      {known ? null : <Notice tone="info" body={t('pay.checks')} />}
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  available: { fontSize: font.sm, fontWeight: '700', marginBottom: space.md },
  spacer: { marginTop: space.sm },
});
