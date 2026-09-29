import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  formatTaka,
  type SubscriptionPlan,
  type SubscriptionState,
} from '@workflex/shared';
import { fetchSubscriptions } from '../../src/api/subscriptions';
import { fetchWallet } from '../../src/api/wallet';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { FREE_BENEFITS, PLAN_COPY } from '../../src/components/subscription/plan-copy';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

type Side = 'INDIVIDUAL' | 'BUSINESS';

/**
 * The plans on offer, and what this account is on.
 *
 * Free is listed as a plan rather than as an absence, because it is one:
 * browsing, applying and uploading a CV are the things this platform exists
 * to do and they are never charged for. A screen that shows only the paid
 * tiers implies the free one is a trial, and somebody on a daily wage
 * deciding whether they can keep using the app deserves better than that.
 *
 * The wallet balance is shown here rather than at the payment step, because
 * being walked through three screens only to be told there is not enough
 * money is the worse way to find out.
 */
export default function SubscriptionScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [side, setSide] = useState<Side>('INDIVIDUAL');

  const state = useQuery<SubscriptionState>({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
  });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });

  const current = state.data?.current ?? null;
  const plans = state.data?.plans ?? [];
  const balance = wallet.data?.balance ?? 0;

  return (
    <MoneyScreen title={t('sub.title')} subtitle={t('sub.subtitle')}>
      {state.error ? (
        <ErrorBanner message={errorMessage(state.error)} tone="onSurface" />
      ) : null}

      {/* The hero, in the app's own colours rather than a new palette. */}
      <View style={[s.hero, { backgroundColor: c.primary }]}>
        <Text style={s.heroTitle}>{t('sub.heroTitle')}</Text>
        <Text style={s.heroBody}>{t('sub.heroBody')}</Text>
      </View>

      <View style={s.sides}>
        {(['INDIVIDUAL', 'BUSINESS'] as Side[]).map((one) => (
          <Pressable
            key={one}
            onPress={() => setSide(one)}
            accessibilityRole="button"
            accessibilityState={{ selected: side === one }}
            style={({ pressed }) => [
              s.side,
              {
                backgroundColor:
                  side === one ? c.primary : pressed ? c.surfaceAlt : c.surface,
                borderColor: side === one ? c.primary : c.border,
              },
            ]}
          >
            <Text style={[s.sideText, { color: side === one ? '#FFFFFF' : c.textMuted }]}>
              {t(`sub.side.${one}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {side === 'BUSINESS' ? (
        <Notice tone="info" title={t('sub.bizTitle')} body={t('sub.bizBody')} />
      ) : null}

      {state.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (
        <>
          {/* Free, as a plan. */}
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: current ? c.border : c.primary },
            ]}
          >
            <View style={s.cardTop}>
              <Text style={[s.planName, { color: c.text }]}>{t('sub.plan.FREE')}</Text>
              {!current ? (
                <View style={[s.tag, { backgroundColor: c.primarySoft }]}>
                  <Text style={[s.tagText, { color: c.primary }]}>{t('sub.current')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.planTag, { color: c.textMuted }]}>{t('sub.tag.FREE')}</Text>
            <Text style={[s.price, { color: c.text }]}>{t('sub.freePrice')}</Text>

            {FREE_BENEFITS.map((key) => (
              <Benefit key={key} label={t(key as TranslationKey)} />
            ))}
          </View>

          {plans.map(({ plan, price, days }) => {
            const copy = PLAN_COPY[plan];
            const active = current?.plan === plan;
            return (
              <View
                key={plan}
                style={[
                  s.card,
                  {
                    backgroundColor: c.surface,
                    borderColor: active || copy.popular ? c.primary : c.border,
                  },
                ]}
              >
                <View style={s.cardTop}>
                  <Text style={[s.planName, { color: c.text }]}>
                    {t(copy.nameKey as TranslationKey)}
                  </Text>
                  {active ? (
                    <View style={[s.tag, { backgroundColor: c.successSoft }]}>
                      <Text style={[s.tagText, { color: c.success }]}>{t('sub.active')}</Text>
                    </View>
                  ) : copy.popular ? (
                    <View style={[s.tag, { backgroundColor: c.primarySoft }]}>
                      <Text style={[s.tagText, { color: c.primary }]}>
                        {t('sub.popular')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[s.planTag, { color: c.textMuted }]}>
                  {t(copy.tagKey as TranslationKey)}
                </Text>
                <Text style={[s.price, { color: c.text }]}>
                  {formatTaka(Math.round(price / 100))}
                  <Text style={[s.per, { color: c.textMuted }]}>
                    {' '}
                    {days ? t('sub.perDays', { n: days }) : t('sub.once')}
                  </Text>
                </Text>

                {copy.benefits.slice(0, 4).map((key) => (
                  <Benefit key={key} label={t(key as TranslationKey)} />
                ))}

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/subscription-plan',
                      params: { plan },
                    })
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    s.cta,
                    {
                      backgroundColor: active ? 'transparent' : c.primary,
                      borderColor: c.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[s.ctaText, { color: active ? c.primary : '#FFFFFF' }]}>
                    {active ? t('sub.manage') : t('sub.see')}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {current ? (
            <Pressable
              onPress={() => router.push('/(app)/subscription-mine')}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.wide,
                { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
              ]}
            >
              <Text style={[s.wideText, { color: c.primary }]}>{t('sub.mine')}</Text>
            </Pressable>
          ) : null}

          <Text style={[s.note, { color: c.textMuted }]}>
            {t('sub.balance', { amount: formatTaka(Math.round(balance / 100)) })}
          </Text>
          <Text style={[s.note, { color: c.textMuted }]}>{t('sub.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

export function Benefit({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={s.benefit}>
      <View style={[s.dot, { backgroundColor: c.success }]} />
      <Text style={[s.benefitText, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.sm },

  hero: { borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  heroTitle: { color: '#FFFFFF', fontSize: font.md, fontWeight: '900' },
  heroBody: { color: '#FFFFFF', fontSize: font.xs + 1, lineHeight: 18, marginTop: 4, opacity: 0.9 },

  sides: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  side: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 9,
    alignItems: 'center',
  },
  sideText: { fontSize: font.xs + 1, fontWeight: '800' },

  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  planName: { flex: 1, fontSize: font.md, fontWeight: '900' },
  planTag: { fontSize: font.xs, marginTop: 2 },
  price: { fontSize: font.lg, fontWeight: '900', marginTop: space.xs },
  per: { fontSize: font.xs, fontWeight: '600' },

  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: font.xs - 2, fontWeight: '900' },

  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  benefitText: { flex: 1, fontSize: font.xs + 1, lineHeight: 18 },

  cta: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: space.md,
  },
  ctaText: { fontSize: font.sm, fontWeight: '800' },

  wide: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: space.md,
  },
  wideText: { fontSize: font.sm, fontWeight: '800' },
});
