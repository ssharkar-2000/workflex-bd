import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatTaka, type SubscriptionState } from '@workflex/shared';
import { cancelSubscription, fetchSubscriptions } from '../../src/api/subscriptions';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { PLAN_COPY } from '../../src/components/subscription/plan-copy';
import { Benefit } from './subscription';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * The plan in force, and how to leave it.
 *
 * Cancelling stops the renewal and nothing else: the plan runs to the date
 * already paid for, and the screen says so before the button is pressed and
 * again afterwards. Anything else would be taking money for days it then
 * refuses to deliver.
 *
 * The cancel control is deliberately plain rather than hidden at the bottom
 * behind a grey link. Somebody who wants to leave and cannot find how is a
 * complaint, and one who leaves easily is a person who might come back.
 */
export default function MySubscriptionScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const state = useQuery<SubscriptionState>({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
  });

  const stop = useMutation({
    mutationFn: (id: string) => cancelSubscription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const current = state.data?.current ?? null;
  const copy = current ? PLAN_COPY[current.plan] : undefined;

  const onCancel = () => {
    if (!current) return;
    Alert.alert(t('sub.cancelTitle'), t('sub.cancelBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sub.cancelYes'),
        style: 'destructive',
        onPress: () => stop.mutate(current.id),
      },
    ]);
  };

  return (
    <MoneyScreen title={t('sub.mineTitle')} subtitle={t('sub.mineSub')}>
      {state.error ? (
        <ErrorBanner message={errorMessage(state.error)} tone="onSurface" />
      ) : null}
      {stop.error ? <ErrorBanner message={errorMessage(stop.error)} tone="onSurface" /> : null}

      {state.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : !current || !copy ? (
        <>
          <Notice tone="info" title={t('sub.noneTitle')} body={t('sub.noneBody')} />
          <Pressable
            onPress={() => router.replace('/(app)/subscription')}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.cta,
              { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={s.ctaText}>{t('sub.seePlans')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.primary }]}>
            <View style={s.top}>
              <Text style={[s.name, { color: c.text }]}>
                {t(copy.nameKey as TranslationKey)}
              </Text>
              <View
                style={[
                  s.tag,
                  {
                    backgroundColor:
                      current.status === 'ACTIVE' ? c.successSoft : c.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={[
                    s.tagText,
                    { color: current.status === 'ACTIVE' ? c.success : c.textMuted },
                  ]}
                >
                  {t(`sub.status.${current.status}` as TranslationKey)}
                </Text>
              </View>
            </View>

            <Text style={[s.price, { color: c.text }]}>
              {formatTaka(Math.round(current.price / 100))}
            </Text>

            <Text style={[s.meta, { color: c.textMuted }]}>
              {current.expiresAt
                ? current.cancelledAt
                  ? t('sub.runsUntil', {
                      date: new Date(current.expiresAt).toLocaleDateString(),
                    })
                  : t('sub.nextBilling', {
                      date: new Date(current.expiresAt).toLocaleDateString(),
                    })
                : t('sub.neverExpires')}
            </Text>

            <Pressable
              onPress={() => router.push('/(app)/subscription')}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.change,
                { borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
              ]}
            >
              <Text style={[s.changeText, { color: c.primary }]}>{t('sub.change')} ›</Text>
            </Pressable>
          </View>

          <Text style={[s.heading, { color: c.text }]}>{t('sub.benefits')}</Text>
          <View style={[s.list, { backgroundColor: c.surface, borderColor: c.border }]}>
            {copy.benefits.map((key) => (
              <Benefit key={key} label={t(key as TranslationKey)} />
            ))}
          </View>

          {current.cancelledAt ? (
            <Notice tone="info" body={t('sub.cancelledNote')} />
          ) : (
            <Pressable
              onPress={onCancel}
              disabled={stop.isPending}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.danger,
                {
                  borderColor: c.dangerBorder,
                  backgroundColor: pressed ? c.dangerSoft : 'transparent',
                  opacity: stop.isPending ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[s.dangerText, { color: c.danger }]}>{t('sub.cancel')}</Text>
            </Pressable>
          )}

          <Notice tone="info" body={t('sub.untilEnd')} />

          {state.data && state.data.history.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('sub.history')}</Text>
              {state.data.history.map((one) => (
                <View key={one.id} style={s.historyRow}>
                  <Text style={[s.historyName, { color: c.text }]}>
                    {t(PLAN_COPY[one.plan].nameKey as TranslationKey)}
                  </Text>
                  <Text style={[s.historyMeta, { color: c.textMuted }]}>
                    {new Date(one.startedAt).toLocaleDateString()} ·{' '}
                    {formatTaka(Math.round(one.price / 100))}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
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
  price: { fontSize: font.lg, fontWeight: '900', marginTop: space.xs },
  meta: { fontSize: font.xs, marginTop: 3 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: font.xs - 2, fontWeight: '900' },

  change: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: space.md,
  },
  changeText: { fontSize: font.xs + 1, fontWeight: '800' },

  list: { borderWidth: 1, borderRadius: radius.lg, padding: space.md },

  cta: { borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: space.md },
  ctaText: { color: '#FFFFFF', fontSize: font.sm, fontWeight: '800' },

  danger: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: space.md,
  },
  dangerText: { fontSize: font.sm, fontWeight: '800' },

  historyRow: { paddingVertical: 7 },
  historyName: { fontSize: font.xs + 1, fontWeight: '700' },
  historyMeta: { fontSize: font.xs, marginTop: 1 },
});
