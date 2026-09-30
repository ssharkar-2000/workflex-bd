import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchHires } from '../../src/api/hires';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { HireGroupCard } from '../../src/components/hires/HireGroupCard';
import { MoneyScreen, OutlineButton } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, space } from '../../src/lib/theme';

/**
 * Everyone this account has hired who is still working, under the job each
 * was hired for — job id and details first, then the people.
 *
 * Tapping a name opens what a recruiter does with a hire: call, pay, rate and
 * review, and finally "is the job fully completed?", which takes the person
 * off this list. They stay in the ratings and the wallet history.
 */
export default function HiredScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const hires = useQuery({ queryKey: ['hires', 'RECRUITER'], queryFn: () => fetchHires('RECRUITER') });
  const groups = hires.data?.groups ?? [];
  const people = groups.reduce((sum, group) => sum + group.people.length, 0);

  return (
    <MoneyScreen
      title={t('hired.title')}
      subtitle={t('hired.subtitle')}
      refreshing={hires.isRefetching}
      onRefresh={() => void hires.refetch()}
    >
      {hires.error ? <ErrorBanner message={errorMessage(hires.error)} tone="onSurface" /> : null}

      {hires.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('hires.emptyTitle')}</Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>{t('hires.emptyBody')}</Text>
          <View style={styles.emptyCta}>
            <OutlineButton
              label={t('hired.toPostings')}
              onPress={() => router.push('/(app)/activity?tab=jobs')}
            />
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.count, { color: c.textMuted }]}>
            {t('hires.summary', { people, jobs: groups.length })}
          </Text>
          {groups.map((group) => (
            <HireGroupCard
              key={group.job.id}
              group={group}
              as="RECRUITER"
              onPay={(person) =>
                router.push({
                  pathname: '/(app)/wallet/pay',
                  params: { jobId: group.job.id, payeeId: person.userId },
                })
              }
            />
          ))}
        </>
      )}
    </MoneyScreen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.lg },
  count: { fontSize: font.sm, fontWeight: '700', marginTop: space.sm },
  empty: { alignItems: 'center', paddingTop: space.xl },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  emptyCta: { alignSelf: 'stretch', marginTop: space.md },
});
