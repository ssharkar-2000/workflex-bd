import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatTaka, type SubscriptionPlan, type SubscriptionState } from '@workflex/shared';
import { fetchSubscriptions, subscribe } from '../../src/api/subscriptions';
import { fetchWallet } from '../../src/api/wallet';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import {
  PAYMENT_METHODS,
  PLAN_COPY,
  type PaymentMethodKey,
} from '../../src/components/subscription/plan-copy';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

function newRequestId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/**
 * Paying for a plan.
 *
 * Every method on this screen reaches the same place: the wallet. WorkFlex
 * BD already takes money through one gateway, and that gateway is what
 * offers bKash, Nagad, a card or a bank transfer. Choosing one here and then
 * charging the wallet is not a shortcut — it is the only honest arrangement,
 * because this app never handles a payment credential and must not appear to.
 *
 * So the flow is: enough balance and the plan starts now; not enough and the
 * chosen method takes you to the top-up that really uses it. The shortfall
 * is named before the button is pressed rather than after.
 */
export default function SubscriptionPayScreen() {
  const { plan } = useLocalSearchParams<{ plan: SubscriptionPlan }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<PaymentMethodKey>('WALLET');
  const [coupon, setCoupon] = useState('');
  const [couponNote, setCouponNote] = useState<string | null>(null);

  const state = useQuery<SubscriptionState>({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
  });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });

  const buy = useMutation({
    mutationFn: () => subscribe({ plan, requestId: newRequestId() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      router.replace('/(app)/subscription-mine');
    },
  });

  const offer = state.data?.plans.find((one) => one.plan === plan);
  const copy = plan ? PLAN_COPY[plan] : undefined;
  const balance = wallet.data?.balance ?? 0;
  const price = offer?.price ?? 0;
  const short = Math.max(0, price - balance);
  const canPayNow = short === 0;

  return (
    <MoneyScreen
      title={t('sub.payTitle')}
      subtitle={copy ? t(copy.nameKey as TranslationKey) : ''}
    >
      {buy.error ? <ErrorBanner message={errorMessage(buy.error)} tone="onSurface" /> : null}

      {state.isLoading || !offer || !copy ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (
        <>
          <View style={[s.summary, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <Text style={[s.planName, { color: c.text }]}>
              {t(copy.nameKey as TranslationKey)}
            </Text>
            <Text style={[s.planPrice, { color: c.text }]}>
              {formatTaka(Math.round(price / 100))}
              <Text style={[s.per, { color: c.textMuted }]}>
                {' '}
                {offer.days ? t('sub.perDays', { n: offer.days }) : t('sub.once')}
              </Text>
            </Text>
          </View>

          <Text style={[s.heading, { color: c.text }]}>{t('sub.selectMethod')}</Text>
          {PAYMENT_METHODS.map((one) => {
            const picked = method === one.key;
            return (
              <Pressable
                key={one.key}
                onPress={() => setMethod(one.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: picked }}
                style={({ pressed }) => [
                  s.method,
                  {
                    borderColor: picked ? c.primary : c.border,
                    backgroundColor: picked ? c.primarySoft : pressed ? c.surfaceAlt : c.surface,
                  },
                ]}
              >
                <View
                  style={[
                    s.radio,
                    { borderColor: picked ? c.primary : c.border },
                    picked && { backgroundColor: c.primary },
                  ]}
                />
                <View style={s.methodBody}>
                  <Text style={[s.methodName, { color: c.text }]}>
                    {t(one.labelKey as TranslationKey)}
                  </Text>
                  {one.key === 'WALLET' ? (
                    <Text style={[s.methodHint, { color: c.textMuted }]}>
                      {t('sub.walletHas', { amount: formatTaka(Math.round(balance / 100)) })}
                    </Text>
                  ) : (
                    <Text style={[s.methodHint, { color: c.textMuted }]}>
                      {t('sub.viaTopUp')}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}

          <Text style={[s.heading, { color: c.text }]}>{t('sub.coupon')}</Text>
          <View style={s.couponRow}>
            <TextInput
              value={coupon}
              onChangeText={setCoupon}
              placeholder={t('sub.couponPlaceholder')}
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
              style={[
                s.couponInput,
                { backgroundColor: c.surface, borderColor: c.border, color: c.text },
              ]}
            />
            <Pressable
              onPress={() => setCouponNote(t('sub.couponNone'))}
              disabled={coupon.trim().length === 0}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.couponButton,
                {
                  borderColor: c.primary,
                  backgroundColor: pressed ? c.primarySoft : 'transparent',
                  opacity: coupon.trim().length === 0 ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[s.couponText, { color: c.primary }]}>{t('sub.apply')}</Text>
            </Pressable>
          </View>
          {couponNote ? (
            <Text style={[s.note, { color: c.textMuted }]}>{couponNote}</Text>
          ) : null}

          <View style={[s.total, { borderTopColor: c.border }]}>
            <Text style={[s.totalLabel, { color: c.textMuted }]}>{t('sub.total')}</Text>
            <Text style={[s.totalValue, { color: c.text }]}>
              {formatTaka(Math.round(price / 100))}
            </Text>
          </View>

          {!canPayNow ? (
            <Notice
              tone="warning"
              body={t('sub.shortBy', { amount: formatTaka(Math.round(short / 100)) })}
            />
          ) : null}

          <Pressable
            onPress={() =>
              canPayNow ? buy.mutate() : router.push('/(app)/wallet/deposits')
            }
            disabled={buy.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.cta,
              { backgroundColor: c.primary, opacity: buy.isPending ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={s.ctaText}>
              {canPayNow ? t('sub.proceed') : t('sub.topUpFirst')}
            </Text>
          </Pressable>

          <Text style={[s.note, { color: c.textMuted }]}>{t('sub.payNote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.sm },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },

  summary: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  planName: { fontSize: font.sm + 1, fontWeight: '800' },
  planPrice: { fontSize: font.lg, fontWeight: '900', marginTop: 2 },
  per: { fontSize: font.xs, fontWeight: '600' },

  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  methodBody: { flex: 1 },
  methodName: { fontSize: font.sm, fontWeight: '700' },
  methodHint: { fontSize: font.xs, marginTop: 1 },

  couponRow: { flexDirection: 'row', gap: space.sm },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: font.sm,
  },
  couponButton: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  couponText: { fontSize: font.xs, fontWeight: '800' },

  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    paddingTop: space.md,
    marginTop: space.lg,
  },
  totalLabel: { fontSize: font.sm, fontWeight: '700' },
  totalValue: { fontSize: font.md, fontWeight: '900' },

  cta: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: space.md,
  },
  ctaText: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '800' },
});
