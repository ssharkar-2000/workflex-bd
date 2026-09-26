import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatTaka, type Deposit, type TopUpStatus } from '@workflex/shared';
import { fetchDeposits } from '../../../src/api/wallet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';
/**
 * Deposits this account has declared, and where each one has got to.
 *
 * The screen exists because a declared deposit is not instant: someone has to
 * find the money on the receiving account first. Without somewhere to see
 * "waiting", a person who added money and saw no change in their balance
 * would reasonably think it had been lost.
 */
export default function DepositsScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const deposits = useQuery({ queryKey: ['deposits'], queryFn: fetchDeposits });

  return (
    <MoneyScreen
      title={t('deposits.title')}
      subtitle={t('deposits.subtitle')}
      refreshing={deposits.isRefetching}
      onRefresh={() => void deposits.refetch()}
    >
      {deposits.error ? (
        <ErrorBanner message={errorMessage(deposits.error)} tone="onSurface" />
      ) : null}

      {deposits.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : (deposits.data?.length ?? 0) === 0 ? (
        <Notice tone="info" body={t('deposits.empty')} />
      ) : (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
          {deposits.data!.map((deposit, i) => (
            <Row key={deposit.id} deposit={deposit} first={i === 0} />
          ))}
        </View>
      )}
    </MoneyScreen>
  );
}

function Row({ deposit, first }: { deposit: Deposit; first: boolean }) {
  const t = useT();
  const { c } = useTheme();

  const tone: Record<TopUpStatus, string> = {
    PAID: c.success,
    PENDING: c.warning,
    HELD: c.warning,
    FAILED: c.danger,
    CANCELLED: c.textMuted,
    REJECTED: c.danger,
  };

  const when = new Date(deposit.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.row, !first && { borderTopColor: c.border, borderTopWidth: 1 }]}>
      <View style={styles.grow}>
        <Text style={[styles.amount, { color: c.text }]}>{formatTaka(deposit.amount)}</Text>
        <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
          {[
            deposit.method ? t(wallet.method.${deposit.method} as TranslationKey) : null,
            deposit.reference,
            when,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {deposit.reviewNote ? (
          <Text style={[styles.note, { color: c.textMuted }]}>{deposit.reviewNote}</Text>
        ) : null}
      </View>

      <Text style={[styles.status, { color: tone[deposit.status] }]}>
        ● {t(deposits.status.${deposit.status} as TranslationKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.lg },
  list: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 13 },
  grow: { flex: 1, gap: 2 },
  amount: { fontSize: font.md, fontWeight: '800' },
  meta: { fontSize: font.xs },
  note: { fontSize: font.xs, lineHeight: 17 },
  status: { fontSize: font.xs, fontWeight: '800' },
});
deposits.data
