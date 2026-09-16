import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatTaka,
  type Applicant,
  type ApplicationStatus,
  type DecideApplicationDto,
  type Locale,
} from '@workflex/shared';
import { decideApplication, fetchApplicants } from '../../../src/api/jobs';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Card, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type Decision = DecideApplicationDto['status'];

/** Same dots as the applicant's own list, so a status reads the same either side. */
const STATUS_DOTS: Record<ApplicationStatus, string> = {
  SUBMITTED: '🔵',
  VIEWED: '🟡',
  SHORTLISTED: '🟢',
  ACCEPTED: '🟢',
  REJECTED: '⚪',
  WITHDRAWN: '⚪',
};

/**
 * The people who applied to one of your postings, and the decision on each.
 *
 * Hiring is what the wallet hangs off: an accepted applicant is someone the
 * poster can call and pay, and nobody else is. Every decision can be changed
 * except a withdrawal, which is the applicant's.
 */
export default function ApplicantsScreen() {
  const t = useT();
  const router = useRouter();
  const [locale] = useLocale();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['applicants', jobId],
    queryFn: () => fetchApplicants(jobId),
    enabled: Boolean(jobId),
  });

  const decide = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: Decision }) =>
      decideApplication(jobId, userId, status),
    onSuccess: (list) => {
      setError(null);
      queryClient.setQueryData(['applicants', jobId], list);
      void queryClient.invalidateQueries({ queryKey: ['payees'] });
      void queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const data = query.data;

  return (
    <MoneyScreen
      title={data?.jobTitle ?? t('applicants.title')}
      subtitle={data ? t('applicants.count', { count: data.applicants.length }) : undefined}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/(app)/job/[id]', params: { id: jobId } })}
        hitSlop={8}
        accessibilityRole="link"
        style={styles.viewPosting}
      >
        <Text style={[styles.viewPostingText, { color: c.primary }]}>
          {t('applicants.viewPosting')} ›
        </Text>
      </Pressable>

      {query.error ? <ErrorBanner message={errorMessage(query.error)} tone="onSurface" /> : null}
      {error ? <ErrorBanner message={error} tone="onSurface" /> : null}
      {data && !data.isOpen ? <Notice tone="info" body={t('applicants.closed')} /> : null}

      {query.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : data && data.applicants.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            {t('applicants.emptyTitle')}
          </Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>
            {t('applicants.emptyBody')}
          </Text>
        </View>
      ) : (
        data?.applicants.map((applicant) => (
          <ApplicantCard
            key={applicant.userId}
            applicant={applicant}
            locale={locale}
            busy={decide.isPending && decide.variables?.userId === applicant.userId}
            onDecide={(status) => decide.mutate({ userId: applicant.userId, status })}
            onPay={() =>
              router.push({
                pathname: '/(app)/wallet/pay',
                params: { jobId, payeeId: applicant.userId },
              })
            }
          />
        ))
      )}
    </MoneyScreen>
  );
}

function ApplicantCard({
  applicant,
  locale,
  busy,
  onDecide,
  onPay,
}: {
  applicant: Applicant;
  locale: Locale;
  busy: boolean;
  onDecide: (status: Decision) => void;
  onPay: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const { status } = applicant;

  const applied = new Date(applicant.appliedAt).toLocaleDateString(
    locale === 'bn' ? 'bn-BD' : 'en-GB',
    { day: 'numeric', month: 'short' },
  );

  return (
    <Card style={status === 'WITHDRAWN' || status === 'REJECTED' ? styles.faded : undefined}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {applicant.name}
          </Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {t('applicants.appliedOn', { date: applied })}
            {applicant.verified ? (
              <Text style={{ color: c.success }}>{`  ✓ ${t('applicants.verified')}`}</Text>
            ) : null}
          </Text>
        </View>
        <Text style={[styles.status, { color: c.textMuted }]}>
          {STATUS_DOTS[status]} {t(`app.status.${status}` as TranslationKey)}
        </Text>
      </View>

      {applicant.message ? (
        <Text style={[styles.message, { color: c.text, borderLeftColor: c.border }]}>
          “{applicant.message}”
        </Text>
      ) : null}

      {status === 'ACCEPTED' ? (
        <View style={[styles.hired, { backgroundColor: c.successSoft }]}>
          <Text style={[styles.hiredNote, { color: c.text }]}>{t('applicants.hiredNote')}</Text>
          <View style={styles.hiredRow}>
            {applicant.phone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${applicant.phone}`)}
                accessibilityRole="button"
                hitSlop={6}
              >
                <Text style={[styles.phone, { color: c.primary }]}>📞 {applicant.phone}</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.paid, { color: c.success }]}>
              {t('applicants.paid', { amount: formatTaka(applicant.paidSoFar) })}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {busy ? <ActivityIndicator color={c.primary} /> : null}

        {!busy && (status === 'SUBMITTED' || status === 'VIEWED' || status === 'SHORTLISTED') ? (
          <>
            <SmallButton label={t('applicants.hire')} primary onPress={() => onDecide('ACCEPTED')} />
            {status !== 'SHORTLISTED' ? (
              <SmallButton label={t('applicants.shortlist')} onPress={() => onDecide('SHORTLISTED')} />
            ) : null}
            <SmallButton label={t('applicants.reject')} quiet onPress={() => onDecide('REJECTED')} />
          </>
        ) : null}

        {!busy && status === 'ACCEPTED' ? (
          <>
            <SmallButton label={`৳ ${t('applicants.pay')}`} primary onPress={onPay} />
            <SmallButton label={t('applicants.unhire')} quiet onPress={() => onDecide('SHORTLISTED')} />
          </>
        ) : null}

        {!busy && status === 'REJECTED' ? (
          <SmallButton label={t('applicants.reconsider')} onPress={() => onDecide('SHORTLISTED')} />
        ) : null}

        {status === 'WITHDRAWN' ? (
          <Text style={[styles.meta, { color: c.textMuted }]}>{t('applicants.withdrew')}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function SmallButton({
  label,
  onPress,
  primary,
  quiet,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  quiet?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.small,
        primary
          ? { backgroundColor: pressed ? c.primaryPressed : c.primary, borderColor: c.primary }
          : quiet
            ? { borderColor: c.border, backgroundColor: 'transparent' }
            : { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : c.surface },
      ]}
    >
      <Text
        style={[
          styles.smallText,
          { color: primary ? c.primaryText : quiet ? c.textMuted : c.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.lg },
  flex: { flex: 1 },
  faded: { opacity: 0.72 },

  viewPosting: { alignSelf: 'flex-start', marginTop: 8 },
  viewPostingText: { fontSize: font.sm, fontWeight: '800' },

  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: font.md, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 3 },
  status: { fontSize: font.xs, fontWeight: '800' },

  message: {
    fontSize: font.sm,
    lineHeight: 20,
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },

  hired: { borderRadius: radius.md, padding: 12, marginTop: 12, gap: 8 },
  hiredNote: { fontSize: font.xs + 1, lineHeight: 18 },
  hiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  phone: { fontSize: font.sm, fontWeight: '800' },
  paid: { fontSize: font.sm, fontWeight: '800' },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  small: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallText: { fontSize: font.sm, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: space.xl },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: 6 },
});
