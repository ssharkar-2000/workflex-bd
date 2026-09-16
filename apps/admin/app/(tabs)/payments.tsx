import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatTaka,
  topUpMethodLabel,
  type AdminTopUp,
  type AdminWithdrawal,
  type PayoutMethod,
  type TopUpStatus,
  type WithdrawalStatus,
} from '@workflex/shared';
import {
  approveTopUp,
  fetchTopUps,
  fetchWalletSummary,
  fetchWithdrawals,
  markWithdrawalPaid,
  rejectTopUp,
  rejectWithdrawal,
} from '../../src/api/admin';
import { errorText } from '../../src/lib/error-message';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Loading,
  Screen,
  StatTile,
} from '../../src/components/ui';
import { colors, font, radius, space } from '../../src/lib/theme';

type Tab = 'withdrawals' | 'topUps';

const WITHDRAWAL_FILTERS = ['PENDING', 'PAID', 'REJECTED', 'CANCELLED', 'ALL'] as const;
const TOP_UP_FILTERS = ['HELD', 'PAID', 'PENDING', 'FAILED', 'REJECTED', 'ALL'] as const;

const METHOD_LABELS: Record<PayoutMethod, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  BANK: 'Bank',
};

const GATEWAY_LABELS = {
  sslcommerz: { text: 'SSLCommerz', tone: 'success' },
  simulator: { text: 'Simulator — no real money', tone: 'warning' },
} as const;

/**
 * Money: the withdrawal queue and payments the gateway flagged.
 *
 * Withdrawals are sent by hand. SSLCommerz collects money and has no call
 * for paying it out, so a reviewer sends each one from the company's bKash,
 * Nagad or bank account and records the transfer's transaction ID here —
 * which is what the person sees on their wallet. The money left their
 * wallet when they asked, so turning a request down puts it back.
 */
export default function PaymentsScreen() {
  const [tab, setTab] = useState<Tab>('withdrawals');
  const [withdrawalFilter, setWithdrawalFilter] =
    useState<(typeof WITHDRAWAL_FILTERS)[number]>('PENDING');
  const [topUpFilter, setTopUpFilter] = useState<(typeof TOP_UP_FILTERS)[number]>('HELD');

  const summary = useQuery({ queryKey: ['admin-wallet-summary'], queryFn: fetchWalletSummary });
  const withdrawals = useQuery({
    queryKey: ['admin-withdrawals', withdrawalFilter],
    queryFn: () => fetchWithdrawals(withdrawalFilter),
    enabled: tab === 'withdrawals',
  });
  const topUps = useQuery({
    queryKey: ['admin-top-ups', topUpFilter],
    queryFn: () => fetchTopUps(topUpFilter),
    enabled: tab === 'topUps',
  });

  const active = tab === 'withdrawals' ? withdrawals : topUps;
  const refresh = () => {
    void summary.refetch();
    void active.refetch();
  };

  const s = summary.data;
  const gateway = s ? (s.gateway ? GATEWAY_LABELS[s.gateway] : null) : undefined;

  return (
    <Screen
      title="Payments"
      subtitle="Wallet top-ups and withdrawals"
      right={
        gateway === undefined ? null : gateway ? (
          <Badge text={gateway.text} tone={gateway.tone} />
        ) : (
          <Badge text="Top-ups off" tone="danger" />
        )
      }
    >
      {summary.isLoading ? (
        <Loading />
      ) : summary.error || !s ? (
        <ErrorState message={errorText(summary.error)} onRetry={() => void summary.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={summary.isRefetching || active.isRefetching}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.grid}>
            <StatTile
              label={`Withdrawals to send (${s.pendingWithdrawals.count})`}
              value={formatTaka(s.pendingWithdrawals.total)}
              tone={s.pendingWithdrawals.count > 0 ? 'warning' : 'default'}
            />
            <StatTile
              label="Held top-ups"
              value={String(s.heldTopUps)}
              tone={s.heldTopUps > 0 ? 'warning' : 'default'}
            />
            <StatTile label="In users' wallets" value={formatTaka(s.heldInWallets)} />
            <StatTile label="Of which withdrawable" value={formatTaka(s.withdrawableInWallets)} />
          </View>

          <Card>
            <Text style={styles.cardTitle}>Last 30 days</Text>
            <Line
              label={`Top-ups (${s.last30Days.topUps.count})`}
              value={formatTaka(s.last30Days.topUps.total)}
            />
            <Line
              label={`Payments to workers (${s.last30Days.payments.count})`}
              value={formatTaka(s.last30Days.payments.total)}
            />
            <Line
              label={`Withdrawals sent (${s.last30Days.withdrawalsPaid.count})`}
              value={formatTaka(s.last30Days.withdrawalsPaid.total)}
            />
          </Card>

          <View style={styles.tabs}>
            {(
              [
                ['withdrawals', 'Withdrawals'],
                ['topUps', 'Top-ups'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                style={[styles.tab, tab === key && styles.tabOn]}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'withdrawals' ? (
            <Filters
              options={WITHDRAWAL_FILTERS}
              value={withdrawalFilter}
              onChange={setWithdrawalFilter}
            />
          ) : (
            <Filters options={TOP_UP_FILTERS} value={topUpFilter} onChange={setTopUpFilter} />
          )}

          {active.isLoading ? (
            <Loading />
          ) : active.error ? (
            <ErrorState message={errorText(active.error)} onRetry={() => void active.refetch()} />
          ) : tab === 'withdrawals' ? (
            (withdrawals.data?.withdrawals ?? []).length === 0 ? (
              <Card>
                <Text style={styles.empty}>Nothing in this queue.</Text>
              </Card>
            ) : (
              withdrawals.data?.withdrawals.map((w) => <WithdrawalRow key={w.id} withdrawal={w} />)
            )
          ) : (topUps.data?.topUps ?? []).length === 0 ? (
            <Card>
              <Text style={styles.empty}>Nothing in this queue.</Text>
            </Card>
          ) : (
            topUps.data?.topUps.map((t) => <TopUpRow key={t.id} topUp={t} />)
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Filters<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.filters}>
      {options.map((f) => (
        <Pressable
          key={f}
          onPress={() => onChange(f)}
          style={[styles.filter, value === f && styles.filterOn]}
        >
          <Text style={[styles.filterText, value === f && styles.filterTextOn]}>{f}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

function useWalletRefresh() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['admin-wallet-summary', 'admin-withdrawals', 'admin-top-ups']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

const WITHDRAWAL_TONES: Record<WithdrawalStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  PAID: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

function WithdrawalRow({ withdrawal: w }: { withdrawal: AdminWithdrawal }) {
  const refresh = useWalletRefresh();
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = useMutation({
    mutationFn: () => markWithdrawalPaid(w.id, reference.trim()),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err)),
  });
  const reject = useMutation({
    mutationFn: () => rejectWithdrawal(w.id, reason.trim()),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err)),
  });

  return (
    <Card>
      <View style={styles.rowTop}>
        <Text style={styles.amount}>{formatTaka(w.amount)}</Text>
        <Badge text={METHOD_LABELS[w.method]} tone="info" />
        <View style={styles.flex} />
        <Badge text={w.status} tone={WITHDRAWAL_TONES[w.status]} />
      </View>
      <Text style={styles.meta}>
        {w.userName ?? 'Unnamed'} ({w.userPhone}) · asked{' '}
        {new Date(w.createdAt).toLocaleString()}
      </Text>

      {/* Everything needed to make the transfer, selectable for copying. */}
      <View style={styles.destination}>
        {w.method === 'BANK' ? (
          <>
            <Detail label="Bank" value={`${w.bankName ?? '—'}, ${w.branchName ?? '—'}`} />
            <Detail label="Account number" value={w.accountNumber} />
            {w.routingNumber ? <Detail label="Routing" value={w.routingNumber} /> : null}
          </>
        ) : (
          <Detail label={`${METHOD_LABELS[w.method]} number`} value={w.accountNumber} />
        )}
        <Detail label="Account name" value={w.accountName} />
      </View>

      {w.status === 'PAID' ? (
        <Text style={styles.outcome}>
          Sent · transaction ID {w.reference} ·{' '}
          {w.processedAt ? new Date(w.processedAt).toLocaleString() : ''}
        </Text>
      ) : null}
      {w.status === 'REJECTED' ? (
        <Text style={styles.outcome}>Turned down: {w.rejectReason}</Text>
      ) : null}

      {w.status === 'PENDING' ? (
        rejecting ? (
          <>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason, shown to the person (e.g. the number is not in their name)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.input, styles.textarea]}
            />
            <View style={styles.actions}>
              <Button
                label="Turn down, return the money"
                tone="danger"
                onPress={() => reject.mutate()}
                loading={reject.isPending}
                disabled={reason.trim().length < 5}
              />
              <Button label="Back" tone="outline" onPress={() => setRejecting(false)} />
            </View>
          </>
        ) : (
          <>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Transaction ID of the transfer you sent"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              style={styles.input}
            />
            <View style={styles.actions}>
              <Button
                label="Mark as sent"
                onPress={() => pay.mutate()}
                loading={pay.isPending}
                disabled={reference.trim().length < 4}
              />
              <Button label="Turn down" tone="outline" onPress={() => setRejecting(true)} />
            </View>
          </>
        )
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const TOP_UP_TONES: Record<TopUpStatus, 'warning' | 'success' | 'danger' | 'neutral' | 'info'> = {
  PENDING: 'info',
  PAID: 'success',
  FAILED: 'neutral',
  CANCELLED: 'neutral',
  HELD: 'warning',
  REJECTED: 'danger',
};

function TopUpRow({ topUp: t }: { topUp: AdminTopUp }) {
  const refresh = useWalletRefresh();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: () => approveTopUp(t.id),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err)),
  });
  const reject = useMutation({
    mutationFn: () => rejectTopUp(t.id, reason.trim()),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err)),
  });

  return (
    <Card>
      <View style={styles.rowTop}>
        <Text style={styles.amount}>{formatTaka(t.amount)}</Text>
        {t.method ? <Badge text={topUpMethodLabel(t.method) ?? t.method} tone="info" /> : null}
        <View style={styles.flex} />
        <Badge text={t.status} tone={TOP_UP_TONES[t.status]} />
      </View>
      <Text style={styles.meta}>
        {t.userName ?? 'Unnamed'} ({t.userPhone}) · {new Date(t.createdAt).toLocaleString()}
      </Text>

      <View style={styles.destination}>
        <Detail label="Reference (tran_id)" value={t.tranId} />
        {t.valId ? <Detail label="Gateway val_id" value={t.valId} /> : null}
        {t.bankTranId ? <Detail label="Bank transaction" value={t.bankTranId} /> : null}
        {t.riskLevel !== null ? (
          <Detail
            label="Gateway risk"
            value={`${t.riskLevel === 1 ? 'Flagged' : 'Safe'}${t.riskTitle ? ` — ${t.riskTitle}` : ''}`}
          />
        ) : null}
        {t.reviewNote ? <Detail label="Note" value={t.reviewNote} /> : null}
      </View>

      {t.status === 'HELD' ? (
        rejecting ? (
          <>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why it is being turned down (refund it from the gateway panel)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.input, styles.textarea]}
            />
            <View style={styles.actions}>
              <Button
                label="Turn down"
                tone="danger"
                onPress={() => reject.mutate()}
                loading={reject.isPending}
                disabled={reason.trim().length < 5}
              />
              <Button label="Back" tone="outline" onPress={() => setRejecting(false)} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              Check this payment in the gateway's merchant panel before deciding.
              Approving credits the person's wallet.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Approve and credit"
                onPress={() => approve.mutate()}
                loading={approve.isPending}
              />
              <Button label="Turn down" tone="outline" onPress={() => setRejecting(true)} />
            </View>
          </>
        )
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1 },

  cardTitle: { color: colors.text, fontSize: font.sm, fontWeight: '800', marginBottom: space.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineLabel: { color: colors.textMuted, fontSize: font.sm },
  lineValue: { color: colors.text, fontSize: font.sm, fontWeight: '800' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.surface },
  tabText: { color: colors.textMuted, fontSize: font.sm, fontWeight: '700' },
  tabTextOn: { color: colors.text, fontWeight: '800' },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700' },
  filterTextOn: { color: colors.primaryText },

  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amount: { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: font.xs, marginTop: 6 },

  destination: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  detail: { flexDirection: 'row', gap: 8 },
  detailLabel: { color: colors.textMuted, fontSize: font.xs, width: 120 },
  detailValue: { color: colors.text, fontSize: font.xs, fontWeight: '700', flex: 1 },

  outcome: { color: colors.text, fontSize: font.xs, marginTop: 10 },
  hint: { color: colors.textMuted, fontSize: font.xs, lineHeight: 17, marginTop: 10 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.sm,
    padding: 10,
    marginTop: 12,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  error: { color: colors.danger, fontSize: font.xs, marginTop: 8 },
  empty: { color: colors.textMuted, fontSize: font.sm },
});
