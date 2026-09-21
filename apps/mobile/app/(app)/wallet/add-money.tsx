import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMutation, useQuery } from '@tanstack/react-query';
import { WALLET_LIMITS, formatTaka } from '@workflex/shared';
import { createTopUp, fetchWallet } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import {
  Card,
  Chip,
  MoneyInput,
  MoneyScreen,
  Notice,
  walletStyles,
} from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font } from '../../../src/lib/theme';

/** Round sums people actually top up by, so most never need the keyboard. */
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

/**
 * Where the gateway sends the payer back to: the wallet, with the top-up's id
 * added by the server. The web app's own address in a browser; the app's link
 * on a phone (workflex://wallet, or exp://…/--/wallet under Expo Go).
 */
function returnUrl(): string {
  if (Platform.OS === 'web') return `${window.location.origin}/wallet`;
  return Linking.createURL('/wallet');
}

/**
 * Adding money.
 *
 * The payment itself happens on the gateway's page, never here: the app asks
 * the server to open a payment, hands the person to the page it gets back,
 * and learns the outcome when the gateway sends them to the wallet. Card
 * numbers and PINs never pass through this app or its server.
 */
export default function AddMoneyScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });
  const gateway = wallet.data?.gateway;

  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const value = Number.parseInt(amount || '0', 10);
  const inRange = value >= WALLET_LIMITS.topUpMin && value <= WALLET_LIMITS.topUpMax;

  const start = useMutation({
    mutationFn: async () => {
      const session = await createTopUp({ amount: value, returnUrl: returnUrl() });
      if (Platform.OS === 'web') {
        // The whole tab goes to the gateway; the gateway brings it back to
        // the wallet, which then shows how the payment went.
        window.location.assign(session.gatewayUrl);
      } else {
        await Linking.openURL(session.gatewayUrl);
      }
      return session;
    },
    onSuccess: (session) => {
      // On a phone the app stays open behind the browser. Put the wallet
      // underneath, already watching this payment, for whenever they switch
      // back — with or without the gateway's link bringing them.
      if (Platform.OS !== 'web') {
        router.dismissTo({ pathname: '/(app)/wallet', params: { topUp: session.id } });
      }
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const pick = (v: string) => {
    setAmount(v);
    if (error) setError(null);
  };

  return (
    <MoneyScreen
      title={t('addMoney.title')}
      subtitle={t('addMoney.subtitle')}
      footer={
        <View style={styles.footer}>
          {error ? <ErrorBanner message={error} tone="onSurface" /> : null}
          <ShimmerButton
            label={
              inRange ? `${t('addMoney.continue')} · ${formatTaka(value)}` : t('addMoney.continue')
            }
            onPress={() => start.mutate()}
            loading={start.isPending}
            disabled={!inRange || !gateway}
          />
          {Platform.OS !== 'web' ? (
            <Text style={[styles.returnHint, { color: c.textMuted }]}>
              {t('addMoney.returnHint')}
            </Text>
          ) : null}
        </View>
      }
    >
      {wallet.data && gateway === null ? (
        <Notice tone="warning" body={t('addMoney.unavailable')} />
      ) : null}
      {gateway === 'simulator' ? (
        <Notice tone="warning" body={t('addMoney.simulator')} />
      ) : null}

      <Card>
        <MoneyInput
          label={t('addMoney.amount')}
          value={amount}
          onChange={pick}
          invalid={amount !== '' && !inRange}
        />
        <View style={walletStyles.chips}>
          {QUICK_AMOUNTS.map((n) => (
            <Chip
              key={n}
              label={formatTaka(n)}
              on={value === n}
              onPress={() => pick(String(n))}
            />
          ))}
        </View>
        {amount !== '' && !inRange ? (
          <Text style={[styles.range, { color: c.danger }]}>
            {t('addMoney.range', {
              min: formatTaka(WALLET_LIMITS.topUpMin),
              max: formatTaka(WALLET_LIMITS.topUpMax),
            })}
          </Text>
        ) : null}
      </Card>

      <Notice tone="info" body={`🔒 ${t('addMoney.how')}`} />
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
  range: { fontSize: font.xs, fontWeight: '700', marginTop: 10 },
  returnHint: { fontSize: font.xs, textAlign: 'center', lineHeight: 17 },
});
