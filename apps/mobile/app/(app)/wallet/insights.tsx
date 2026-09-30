import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  formatTaka,
  type InsightsRange,
  type WalletEntry,
  type WalletEntryType,
} from '@workflex/shared';
import { fetchInsights, fetchStatement } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { InsightsDonut } from '../../../src/components/wallet/InsightsDonut';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useLocale } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type Tab = 'INCOME' | 'EXPENSE' | 'ADDED';

const RANGES: InsightsRange[] = ['D', 'W', 'M', 'Y'];

/** Which kinds of movement belong under each tab. */
const TAB_TYPES: Record<Tab, WalletEntryType[]> = {
  INCOME: ['PAYMENT_RECEIVED', 'WITHDRAWAL_RETURNED'],
  EXPENSE: ['PAYMENT_SENT', 'WITHDRAWAL'],
  ADDED: ['TOP_UP'],
};

/**
 * Where the money came from and went, over a chosen span.
 *
 * The totals come from the server, which counts every row in the span; the
 * list under them is the statement, which is paged. So the figure at the top
 * can be larger than the rows visible below it, and that is correct — the
 * alternative is a total that only counts what happens to have loaded.
 */
export default function InsightsScreen() {
  const t = useT();
  const [locale] = useLocale();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const [tab, setTab] = useState<Tab>('INCOME');
  const [range, setRange] = useState<InsightsRange>('M');

  const insights = useQuery({
    queryKey: ['wallet-insights', range],
    queryFn: () => fetchInsights(range),
  });

  const statement = useInfiniteQuery({
    queryKey: ['wallet-statement'],
    queryFn: ({ pageParam }) => fetchStatement(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = statement.data?.pages.flatMap((page) => page.entries) ?? [];
  const since = insights.data ? new Date(insights.data.since) : null;
  const shown = entries.filter(
    (entry) =>
      TAB_TYPES[tab].includes(entry.type) &&
      (!since || new Date(entry.createdAt) >= since),
  );

  const total = insights.data
    ? tab === 'INCOME'
      ? insights.data.income
      : tab === 'EXPENSE'
        ? insights.data.expense
        : insights.data.added
    : null;

  return (
    <MoneyScreen
      title={t('insights.title')}
      refreshing={insights.isRefetching}
      onRefresh={() => {
        void insights.refetch();
        void statement.refetch();
      }}
    >
      {/* Which side of the ledger */}
      <View style={[s.tabs, { backgroundColor: c.surfaceAlt }]}>
        {(['INCOME', 'EXPENSE', 'ADDED'] as Tab[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => setTab(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === option }}
            style={[s.tab, tab === option && { backgroundColor: c.primary }]}
          >
            <Text
              style={[
                s.tabText,
                { color: tab === option ? c.primaryText : c.textMuted },
              ]}
            >
              {t(`insights.tab.${option}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {insights.error ? (
        <ErrorBanner message={errorMessage(insights.error)} tone="onSurface" />
      ) : null}

      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[s.totalLabel, { color: c.textMuted }]}>
          {t(`insights.total.${tab}` as TranslationKey)}
        </Text>
        {total === null ? (
          <ActivityIndicator color={c.primary} style={s.loading} />
        ) : (
          <Text style={[s.total, { color: c.text }]}>{formatTaka(total)}</Text>
        )}

        {/* Day, week, month, year */}
        <View style={s.ranges}>
          {RANGES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setRange(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: range === option }}
              style={[
                s.range,
                {
                  backgroundColor: range === option ? c.primarySoft : 'transparent',
                  borderColor: range === option ? c.primarySoftBorder : c.border,
                },
              ]}
            >
              <Text
                style={[
                  s.rangeText,
                  { color: range === option ? c.primary : c.textMuted },
                ]}
              >
                {t(`insights.range.${option}` as TranslationKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {shown.length > 0 ? <InsightsDonut entries={shown} /> : null}

      <Text style={[s.section, { color: c.text }]}>{t('insights.history')}</Text>

      {statement.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : shown.length === 0 ? (
        <Text style={[s.empty, { color: c.textMuted }]}>
          {t('insights.empty')}
        </Text>
      ) : (
        <View style={[s.list, { backgroundColor: c.surface, borderColor: c.border }]}>
          {shown.map((entry, i) => (
            <Row key={entry.id} entry={entry} first={i === 0} locale={locale} />
          ))}
        </View>
      )}

      {statement.hasNextPage ? (
        <Pressable
          onPress={() => void statement.fetchNextPage()}
          disabled={statement.isFetchingNextPage}
          accessibilityRole="button"
          style={s.more}
        >
          {statement.isFetchingNextPage ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <Text style={[s.moreText, { color: c.primary }]}>{t('wallet.loadMore')}</Text>
          )}
        </Pressable>
      ) : null}
    </MoneyScreen>
  );
}

function Row({
  entry,
  first,
  locale,
}: {
  entry: WalletEntry;
  first: boolean;
  locale: string;
}) {
  const t = useT();
  const { c } = useTheme();

  const when = new Date(entry.createdAt).toLocaleDateString(
    locale === 'bn' ? 'bn-BD' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );

  return (
    <View style={[s.row, !first && { borderTopColor: c.border, borderTopWidth: 1 }]}>
      <View style={s.grow}>
        <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>
          {entry.counterparty ?? t(`insights.kind.${entry.type}` as TranslationKey)}
        </Text>
        <Text style={[s.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
          {[entry.jobTitle, when].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text
        style={[s.rowAmount, { color: entry.amount > 0 ? c.success : c.text }]}
      >
        {entry.amount > 0 ? '+' : ''}
        {formatTaka(entry.amount)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginTop: space.sm },
  tab: { flex: 1, borderRadius: radius.pill, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: font.sm, fontWeight: '800' },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
    gap: 2,
  },
  totalLabel: { fontSize: font.xs, fontWeight: '700' },
  total: { fontSize: font.display, fontWeight: '800', letterSpacing: -0.5 },
  ranges: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  range: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    alignItems: 'center',
  },
  rangeText: { fontSize: font.sm, fontWeight: '800' },

  section: { fontSize: font.lg, fontWeight: '800', marginTop: space.lg, marginBottom: 10 },
  empty: { fontSize: font.sm, lineHeight: 20 },
  loading: { marginTop: space.md },

  list: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  grow: { flex: 1, gap: 2 },
  rowTitle: { fontSize: font.sm + 1, fontWeight: '700' },
  rowMeta: { fontSize: font.xs },
  rowAmount: { fontSize: font.md, fontWeight: '800' },

  more: { alignItems: 'center', paddingVertical: 14 },
  moreText: { fontSize: font.sm, fontWeight: '800' },
});
