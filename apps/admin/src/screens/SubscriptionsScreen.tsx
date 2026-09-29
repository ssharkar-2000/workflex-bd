import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page, Subscription, SubscriptionPlan, SubscriptionSummary } from '../api/types';
import { BackButton, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate, taka } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Styles = ReturnType<typeof createStyles>;
type Txt = ReturnType<typeof buildText>;

const PLAN_LABEL_KEY: Record<SubscriptionPlan, string> = {
  FREE: 'subscriptionPlan.free',
  BASIC: 'subscriptionPlan.basic',
  PRO: 'subscriptionPlan.pro',
};

type TypeFilter = 'ALL' | 'WORKER' | 'EMPLOYER';
type PlanFilter = 'ALL' | SubscriptionPlan;

/// "Kon user kon dhoroner subscription kena ache" — one screen listing every
/// worker's and employer's plan, with their lifetime transacted amount
/// alongside it since that was asked for in the same breath.
export function SubscriptionsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('ALL');

  const summary = useApi<SubscriptionSummary>('/subscriptions/summary');
  const query = [
    typeFilter !== 'ALL' ? `subscriberType=${typeFilter}` : null,
    planFilter !== 'ALL' ? `plan=${planFilter}` : null,
    'limit=50',
  ]
    .filter(Boolean)
    .join('&');
  const { data, loading, error, refetch } = useApi<Page<Subscription>>(
    `/subscriptions?${query}`,
    [typeFilter, planFilter],
  );

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={text.screenTitle}>{t('subscriptions.title')}</Text>
            <Text style={[text.caption, { marginTop: 2 }]}>{t('subscriptions.subtitle')}</Text>

            {summary.data ? (
              <View style={s.grid}>
                {(['FREE', 'BASIC', 'PRO'] as SubscriptionPlan[]).map((plan) => (
                  <View key={plan} style={[s.summaryCard, shadow.card, { backgroundColor: categoryTint(categoryPalette, plan).bg }]}>
                    <Text style={[text.stat, { color: categoryTint(categoryPalette, plan).fg }]}>
                      {summary.data!.byPlan[plan] ?? 0}
                    </Text>
                    <Text style={[text.caption, { color: categoryTint(categoryPalette, plan).fg }]}>
                      {t(PLAN_LABEL_KEY[plan])}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg }}>
              <FilterTabs
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'ALL', label: t('subscriptions.filterAll') },
                  { value: 'WORKER', label: t('subscriptions.filterWorkers') },
                  { value: 'EMPLOYER', label: t('subscriptions.filterEmployers') },
                ]}
              />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <FilterTabs
                value={planFilter}
                onChange={setPlanFilter}
                options={[
                  { value: 'ALL', label: t('common.all') },
                  { value: 'FREE', label: t('subscriptionPlan.free') },
                  { value: 'BASIC', label: t('subscriptionPlan.basic') },
                  { value: 'PRO', label: t('subscriptionPlan.pro') },
                ]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <Text style={[text.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
              {t('subscriptions.empty')}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[s.row, shadow.card]}>
            <View style={s.rowHead}>
              <View style={s.grow}>
                <Text style={s.name} numberOfLines={1}>
                  {item.subscriberName}
                </Text>
                <Text style={text.micro}>
                  {item.subscriberType === 'WORKER' ? t('subscriptions.filterWorkers') : t('subscriptions.filterEmployers')}
                  {item.subscriberCode ? ` · ${item.subscriberCode}` : ''}
                </Text>
              </View>
              <View style={[s.planBadge, { backgroundColor: categoryTint(categoryPalette, item.plan).bg }]}>
                <Text style={[s.planBadgeText, { color: categoryTint(categoryPalette, item.plan).fg }]}>
                  {t(PLAN_LABEL_KEY[item.plan])}
                </Text>
              </View>
            </View>

            <View style={s.rowMeta}>
              <StatusPill value={item.status} />
              <Text style={text.micro}>
                {t('subscriptions.startedOn')} {longDate(item.startedAt)}
                {'  ·  '}
                {item.expiresAt ? `${t('subscriptions.expiresOn')} ${longDate(item.expiresAt)}` : t('subscriptions.noExpiry')}
              </Text>
            </View>

            <View style={s.rowFoot}>
              <Text style={text.caption}>{t('subscriptions.totalTransacted')}</Text>
              <Text style={s.totalValue}>{taka(item.totalTransacted, true)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: Txt) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    grid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    summaryCard: { flex: 1, borderRadius: radii.lg, padding: spacing.lg, alignItems: 'center' },
    grow: { flex: 1 },
    row: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
    rowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
    name: { fontSize: 15, fontWeight: '700', color: colors.textDark },
    planBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999 },
    planBadgeText: { fontSize: 12, fontWeight: '700' },
    rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
    rowFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    totalValue: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  });
}
