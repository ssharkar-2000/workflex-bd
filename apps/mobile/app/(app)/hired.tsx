import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatTaka, type Payee } from '@workflex/shared';
import { fetchPayees } from '../../src/api/wallet';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { Card, MoneyScreen, OutlineButton } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * Everyone this account has hired, across all its postings, with what each
 * has been paid — the place a recruiter comes to pay people.
 *
 * One row per person per job: someone hired twice for two different jobs is
 * paid for each separately, so they appear twice.
 */
export default function HiredScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const payees = useQuery({ queryKey: ['payees'], queryFn: fetchPayees });
  const list = payees.data?.payees ?? [];

  return (
    <MoneyScreen
      title={t('hired.title')}
      subtitle={t('hired.subtitle')}
      refreshing={payees.isRefetching}
      onRefresh={() => void payees.refetch()}
    >
      {payees.error ? (
        <ErrorBanner message={errorMessage(payees.error)} tone="onSurface" />
      ) : null}

      {payees.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🤝</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('hired.emptyTitle')}</Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>{t('hired.emptyBody')}</Text>
          <View style={styles.emptyCta}>
            <OutlineButton
              label={t('hired.toPostings')}
              onPress={() => router.push('/(app)/activity?tab=jobs')}
            />
          </View>
        </View>
      ) : (
        list.map((payee) => (
          <PayeeRow
            key={`${payee.jobId}:${payee.payeeId}`}
            payee={payee}
            onPay={() =>
              router.push({
                pathname: '/(app)/wallet/pay',
                params: { jobId: payee.jobId, payeeId: payee.payeeId },
              })
            }
          />
        ))
      )}
    </MoneyScreen>
  );
}

function PayeeRow({ payee, onPay }: { payee: Payee; onPay: () => void }) {
  const t = useT();
  const { c } = useTheme();

  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {payee.name}
          </Text>
          <Text style={[styles.job, { color: c.textMuted }]} numberOfLines={1}>
            {payee.jobTitle}
          </Text>
        </View>
        <Text style={[styles.paid, { color: payee.paidSoFar > 0 ? c.success : c.textMuted }]}>
          {t('hired.paidSoFar', { amount: formatTaka(payee.paidSoFar) })}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => void Linking.openURL(`tel:${payee.phone}`)}
          accessibilityRole="button"
          accessibilityLabel={`${t('hired.call')} ${payee.name}`}
          style={[styles.call, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}
        >
          <Text style={[styles.callText, { color: c.text }]}>📞 {t('hired.call')}</Text>
        </Pressable>
        <Pressable
          onPress={onPay}
          accessibilityRole="button"
          accessibilityLabel={`${t('hired.pay')} ${payee.name}`}
          style={({ pressed }) => [
            styles.pay,
            { backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
        >
          <Text style={[styles.payText, { color: c.primaryText }]}>৳ {t('hired.pay')}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.lg },
  flex: { flex: 1 },

  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: font.md, fontWeight: '800' },
  job: { fontSize: font.xs + 1, marginTop: 2 },
  paid: { fontSize: font.sm, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  call: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  callText: { fontSize: font.sm, fontWeight: '800' },
  pay: { flex: 1.4, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  payText: { fontSize: font.sm, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: space.xl },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  emptyCta: { alignSelf: 'stretch', marginTop: space.md },
});
