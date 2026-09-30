import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatTaka, type SubscriptionPlan, type SubscriptionState } from '@workflex/shared';
import { fetchSubscriptions } from '../../src/api/subscriptions';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { PLAN_COPY } from '../../src/components/subscription/plan-copy';
import { Benefit } from './subscription';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * One plan, in full: what it costs, everything it includes, and who it suits.
 *
 * The "who it suits" box is the honest half of a sales page. Naming the
 * people a plan is *not* for is what stops somebody on a daily wage paying
 * for tools they will not open, and a subscription somebody regrets is worth
 * less than the free account they would otherwise have kept using.
 */
export default function PlanDetailsScreen() {
  const { plan } = useLocalSearchParams<{ plan: SubscriptionPlan }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const state = useQuery<SubscriptionState>({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
  });

  const offer = state.data?.plans.find((one) => one.plan === plan);
  const copy = plan ? PLAN_COPY[plan] : undefined;
  const active = state.data?.current?.plan === plan;

  return (
    <MoneyScreen
      title={t('sub.detailsTitle')}
      subtitle={copy ? t(copy.nameKey as TranslationKey) : ''}
    >
      {state.isLoading || !offer || !copy ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (
        <>
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.primary }]}>
            <View style={s.top}>
              <Text style={[s.name, { color: c.text }]}>
                {t(copy.nameKey as TranslationKey)}
              </Text>
              {copy.popular ? (
                <View style={[s.tag, { backgroundColor: c.primarySoft }]}>
                  <Text style={[s.tagText, { color: c.primary }]}>{t('sub.popular')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.tagline, { color: c.textMuted }]}>
              {t(copy.tagKey as TranslationKey)}
            </Text>
            <Text style={[s.price, { color: c.text }]}>
              {formatTaka(Math.round(offer.price / 100))}
              <Text style={[s.per, { color: c.textMuted }]}>
                {' '}
                {offer.days ? t('sub.perDays', { n: offer.days }) : t('sub.once')}
              </Text>
            </Text>
          </View>

          <Text style={[s.heading, { color: c.text }]}>{t('sub.included')}</Text>
          <View style={[s.list, { backgroundColor: c.surface, borderColor: c.border }]}>
            {copy.benefits.map((key) => (
              <Benefit key={key} label={t(key as TranslationKey)} />
            ))}
          </View>

          <Notice tone="info" title={t('sub.suitsTitle')} body={t(copy.suitsKey as TranslationKey)} />

          {active ? (
            <Notice tone="success" body={t('sub.alreadyOn')} />
          ) : (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(app)/subscription-pay', params: { plan } })
              }
              accessibilityRole="button"
              style={({ pressed }) => [
                s.cta,
                { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={s.ctaText}>
                {t('sub.choose', { name: t(copy.nameKey as TranslationKey) })}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            hitSlop={8}
            style={s.compare}
          >
            <Text style={[s.compareText, { color: c.primary }]}>{t('sub.compare')}</Text>
          </Pressable>
        </>
      )}
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },

  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: font.md, fontWeight: '900' },
  tagline: { fontSize: font.xs, marginTop: 2 },
  price: { fontSize: font.xl, fontWeight: '900', marginTop: space.sm },
  per: { fontSize: font.sm, fontWeight: '600' },
  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: font.xs - 2, fontWeight: '900' },

  list: { borderWidth: 1, borderRadius: radius.lg, padding: space.md },

  cta: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: space.md,
  },
  ctaText: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '800' },

  compare: { alignSelf: 'center', marginTop: space.md },
  compareText: { fontSize: font.xs + 1, fontWeight: '800' },
});
