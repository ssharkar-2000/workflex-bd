import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  formatTaka,
  topUpMethodLabel,
  type Locale,
  type PayoutMethod,
  type WalletEntry,
} from '@workflex/shared';
import { toApiError } from '../../src/api/client';
import {
  cancelWithdrawal,
  fetchReceipts,
  fetchStatement,
  fetchWallet,
} from '../../src/api/wallet';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { BalanceCard } from '../../src/components/wallet/BalanceCard';
import { PaymentReceivedModal } from '../../src/components/wallet/PaymentReceivedModal';
import { QuickActions } from '../../src/components/wallet/QuickActions';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT, type Translate, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { useAuthStore } from '../../src/store/auth-store';
import { getSecure, setSecure } from '../../src/lib/secure-storage';
import { font, radius, space } from '../../src/lib/theme';

/**
 * The wallet: what is in it, what can be done with it, and everything that
 * has moved through it.
 *
 * Opened with ?topUp=<id> when the payment gateway sends someone back, in
 * which case the result of that payment is the first thing on the screen.
 */
export default function WalletScreen() {
  const t = useT();
  const router = useRouter();
  const [locale] = useLocale();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { topUp: topUpId } = useLocalSearchParams<{ topUp?: string }>();
  const user = useAuthStore((state) => state.user);

  // The moment this device last announced a payment. Kept here rather than on
  // the server so the same payment is announced once per device, and a phone
  // that has been closed for a week does not come back to a week of modals.
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [announced, setAnnounced] = useState<string[]>([]);

  useEffect(() => {
    void getSecure('walletReceiptsSeenAt').then((value) => setLastSeen(value ?? EPOCH));
  }, []);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });
  const receipts = useQuery({
    queryKey: ['wallet-receipts', lastSeen],
    queryFn: () => fetchReceipts(lastSeen ?? undefined),
    enabled: lastSeen !== null,
    // Often enough that a payment made while the screen is open is announced
    // without the person refreshing; rarely enough to be free.
    refetchInterval: 20_000,
  });
  const statement = useInfiniteQuery({
    queryKey: ['wallet-statement'],
    queryFn: ({ pageParam }) => fetchStatement(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-statement'] });
    void queryClient.invalidateQueries({ queryKey: ['deposits'] });
  };

  const cancel = useMutation({
    mutationFn: cancelWithdrawal,
    onSuccess: refresh,
  });

  const entries = statement.data?.pages.flatMap((page) => page.entries) ?? [];
  const data = wallet.data;
  const unannounced =
    receipts.data?.filter((payment) => !announced.includes(payment.id)) ?? [];
  const showing = unannounced[0] ?? null;

  const dismissReceipt = () => {
    if (!showing) return;
    setAnnounced((ids) => [...ids, showing.id]);
    // Remember the moment, not the id: anything older than this has been
    // seen, so a reinstall does not replay months of payments.
    void setSecure('walletReceiptsSeenAt', showing.receivedAt);
    setLastSeen(showing.receivedAt);
  };

  // A wallet screen answers "what is in it and what just happened"; the
  // whole ledger is a question for Insights, which is built for it.
  const recent = entries.slice(0, RECENT_COUNT);

  return (
    <MoneyScreen
      title={t('wallet.title')}
      refreshing={wallet.isRefetching || statement.isRefetching}
      onRefresh={refresh}
    >
      {wallet.error ? <ErrorBanner message={errorMessage(wallet.error)} tone="onSurface" /> : null}

      <PaymentReceivedModal payment={showing} onDismiss={dismissReceipt} />

      <BalanceCard
        wallet={data}
        name={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || null}
        publicId={user?.publicId ?? null}
        onLoadMoney={() => router.push('/(app)/wallet/add-money')}
      />

      <QuickActions
        actions={[
          {
            icon: '＋',
            label: t('wallet.addMoney'),
            tint: '#E6F6EE',
            ink: '#16794B',
            onPress: () => router.push('/(app)/wallet/add-money'),
          },
          {
            icon: '⇢',
            label: t('wallet.pay'),
            tint: '#EDEBFB',
            ink: '#3A34A0',
            onPress: () => router.push('/(app)/wallet/pay'),
          },
          {
            icon: '◔',
            label: t('wallet.insights'),
            tint: '#FFEFE2',
            ink: '#C2551F',
            onPress: () => router.push('/(app)/wallet/insights'),
          },
          {
            icon: '⌗',
            label: t('wallet.scan'),
            tint: '#E4F1FD',
            ink: '#1D5FA8',
            onPress: () => router.push('/(app)/wallet/scan'),
          },
          {
            icon: '▣',
            label: t('wallet.receive'),
            tint: '#FDECF3',
            ink: '#A83164',
            onPress: () => router.push('/(app)/wallet/receive'),
          },
          {
            icon: '↑',
            label: t('wallet.withdraw'),
            tint: '#FFF6DC',
            ink: '#8A6200',
            onPress: () => router.push('/(app)/wallet/withdraw'),
          },
        ]}
      />

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: c.text }]}>{t('wallet.recentHistory')}</Text>
        {entries.length > recent.length ? (
          <Pressable
            onPress={() => router.push('/(app)/wallet/insights')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.seeAll, { color: c.primary }]}>{t('wallet.seeAll')}</Text>
          </Pressable>
        ) : null}
      </View>

      {cancel.error ? <ErrorBanner message={errorMessage(cancel.error)} tone="onSurface" /> : null}
      {statement.error ? (
        <ErrorBanner message={errorMessage(statement.error)} tone="onSurface" />
      ) : null}

      {statement.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👛</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('wallet.emptyTitle')}</Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>{t('wallet.emptyBody')}</Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
          {recent.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              locale={locale}
              first={i === 0}
              cancelling={cancel.isPending && cancel.variables === entry.withdrawal?.id}
              onCancel={(id) => cancel.mutate(id)}
            />
          ))}
        </View>
      )}

    </MoneyScreen>
  );
}

/** The chip behind a row's icon, in the colour that kind of movement owns. */
function chipTint(type: WalletEntry['type'], c: { successSoft: string; primarySoft: string; aiSoft: string; surfaceAlt: string }): string {
  switch (type) {
    case 'PAYMENT_RECEIVED':
    case 'WITHDRAWAL_RETURNED':
      return c.successSoft;
    case 'TOP_UP':
      return c.primarySoft;
    case 'WITHDRAWAL':
      return c.aiSoft;
    default:
      return c.surfaceAlt;
  }
}

const ENTRY_ICONS: Record<WalletEntry['type'], string> = {
  TOP_UP: '➕',
  PAYMENT_SENT: '📤',
  PAYMENT_RECEIVED: '📥',
  WITHDRAWAL: '🏦',
  WITHDRAWAL_RETURNED: '↩️',
};

function methodName(t: Translate, method: PayoutMethod): string {
  return t(wallet.method.${method} as TranslationKey);
}

/** "bKash" and "Nagad" in the reader's language; anything else as the gateway named it. */
function topUpVia(t: Translate, cardType: string | null): string | null {
  const label = topUpMethodLabel(cardType);
  if (label === 'bKash') return t('wallet.method.BKASH');
  if (label === 'Nagad') return t('wallet.method.NAGAD');
  return label;
}

function EntryRow({
  entry,
  locale,
  first,
  cancelling,
  onCancel,
}: {
  entry: WalletEntry;
  locale: Locale;
  first: boolean;
  cancelling: boolean;
  onCancel: (withdrawalId: string) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const w = entry.withdrawal;

  let title: string;
  let detail: string | null = null;
  switch (entry.type) {
    case 'TOP_UP': {
      const via = topUpVia(t, entry.topUpMethod);
      title = via ? t('wallet.entry.topUpVia', { method: via }) : t('wallet.entry.topUp');
      break;
    }
    case 'PAYMENT_SENT':
      title = t('wallet.entry.sent', { name: entry.counterparty ?? '' });
      detail = entry.jobTitle;
      break;
    case 'PAYMENT_RECEIVED':
      title = t('wallet.entry.received', { name: entry.counterparty ?? '' });
      detail = entry.jobTitle;
      break;
    case 'WITHDRAWAL':
      title = t('wallet.entry.withdrawal', { method: w ? methodName(t, w.method) : '' });
      detail = w?.account ?? null;
      break;
    case 'WITHDRAWAL_RETURNED':
      title = t('wallet.entry.returned');
      detail = w?.account ?? null;
      break;
  }

  const when = new Date(entry.createdAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusTone =
    w?.status === 'PAID' ? c.success : w?.status === 'PENDING' ? c.warning : c.textMuted;

  return (
    <View style={[styles.row, !first && { borderTopColor: c.border, borderTopWidth: 1 }]}>
      <View style={[styles.rowChip, { backgroundColor: chipTint(entry.type, c) }]}>
        <Text style={styles.rowChipIcon}>{ENTRY_ICONS[entry.type]}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text
            style={[
              styles.rowAmount,
              { color: entry.amount > 0 ? c.success : c.text },
            ]}
          >
            {entry.amount > 0 ? '+' : ''}
            {formatTaka(entry.amount)}
          </Text>
        </View>

        <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
          {[when, detail].filter(Boolean).join(' · ')}
        </Text>
        {entry.note ? (
          <Text style={[styles.rowNote, { color: c.textMuted }]}>“{entry.note}”</Text>
        ) : null}

        {/* Where a withdrawal has got to, on the row that asked for it. */}
        {entry.type === 'WITHDRAWAL' && w ? (
          <View style={styles.rowStatus}>
            <Text style={[styles.status, { color: statusTone }]}>
              ● {t(wallet.wstatus.${w.status} as TranslationKey)}
            </Text>
            {w.status === 'PAID' && w.reference ? (
              <Text style={[styles.rowMeta, { color: c.textMuted }]} selectable>
                {t('wallet.reference', { ref: w.reference })}
              </Text>
            ) : null}
            {w.status === 'PENDING' ? (
              <Pressable
                onPress={() => onCancel(w.id)}
                disabled={cancelling}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.cancel, { color: c.danger }]}>
                  {cancelling ? '…' : t('wallet.cancelWithdrawal')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {entry.type === 'WITHDRAWAL_RETURNED' && w?.rejectReason ? (
          <Text style={[styles.rowNote, { color: c.text }]}>
            {t('wallet.reason', { reason: w.rejectReason })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  simulator: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: space.sm,
  },
  simulatorText: { fontSize: font.xs, fontWeight: '800' },

  earnedHint: { fontSize: font.xs, lineHeight: 17, marginTop: space.sm, marginBottom: space.md },

  waiting: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    marginTop: space.md,
  },
  waitingText: { fontSize: font.sm, fontWeight: '800' },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: 10,
  },
  section: { fontSize: font.lg, fontWeight: '800' },
  seeAll: { fontSize: font.sm, fontWeight: '800' },
  loading: { marginTop: space.md },

  list: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14 },
  // Rows are taller now that the icon sits in a chip.
  row: { flexDirection: 'row', gap: 12, paddingVertical: 13 },
  rowChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowChipIcon: { fontSize: 18 },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { flex: 1, fontSize: font.sm + 1, fontWeight: '700' },
  rowAmount: { fontSize: font.md, fontWeight: '800' },
  rowMeta: { fontSize: font.xs },
  rowNote: { fontSize: font.xs, lineHeight: 17 },
  rowStatus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 2 },
  status: { fontSize: font.xs, fontWeight: '800' },
  cancel: { fontSize: font.xs, fontWeight: '800' },

  more: { alignItems: 'center', paddingVertical: 14 },
  moreText: { fontSize: font.sm, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: space.lg },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: 6 },
});

/** How many rows the wallet shows before sending you to Insights. */
const RECENT_COUNT = 6;

/** Before this app existed, so a first run announces only the last day. */
const EPOCH = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
statement.data
