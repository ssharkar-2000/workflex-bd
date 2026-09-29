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
 * The worker's side of the hired list: every job this account was hired
 * for, with its id and details and the recruiter who hired it.
 *
 * Finished jobs stay, marked as completed, below the ongoing ones — the end
 * of a job is when a worker has something to say about who they worked for,
 * so rating and reviewing the recruiter must still be possible then.
 */
export default function MyRecruitersScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const hires = useQuery({ queryKey: ['hires', 'WORKER'], queryFn: () => fetchHires('WORKER') });
  const groups = hires.data?.groups ?? [];

  return (
    <MoneyScreen
      title={t('hires.recruitersTitle')}
      subtitle={t('hires.recruitersSubtitle')}
      refreshing={hires.isRefetching}
      onRefresh={() => void hires.refetch()}
    >
      {hires.error ? <ErrorBanner message={errorMessage(hires.error)} tone="onSurface" /> : null}

      {hires.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            {t('hires.recruitersEmptyTitle')}
          </Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>
            {t('hires.recruitersEmptyBody')}
          </Text>
          <View style={styles.emptyCta}>
            <OutlineButton label={t('hires.findWork')} onPress={() => router.push('/(app)/jobs')} />
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.count, { color: c.textMuted }]}>
            {t('hires.recruitersCount', { jobs: groups.length })}
          </Text>
          {groups.map((group) => (
            <HireGroupCard key={group.job.id} group={group} as="WORKER" />
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
