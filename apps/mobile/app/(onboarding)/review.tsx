import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLaunchStore } from '../../src/store/launch-store';
import type { TranslationKey } from '../../src/i18n';
import { StepShell } from '../../src/components/onboarding/StepShell';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import {
  fetchOnboardingStatus,
  submitOnboarding,
} from '../../src/api/onboarding';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { useStepCount } from '../../src/lib/onboarding-steps';

export default function ReviewScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { total, offset } = useStepCount();
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
  });

  const submit = useMutation({
    mutationFn: submitOnboarding,
    onSuccess: (status) => {
      queryClient.setQueryData(['onboarding-status'], status);
      void queryClient.invalidateQueries({ queryKey: ['me'] });

      // Straight to the dashboard, holding the session. This step used to end
      // registration and signed out so the new password got used once, but
      // verification is now reachable from the dashboard by an already
      // signed-in user — logging them out mid-flow would be a surprise, and
      // the account is fully usable while review is pending anyway.
      useLaunchStore.getState().open();
      router.replace('/(app)/home');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (isLoading || !data) {
    return (
      <StepShell step={3 + offset} total={total} title={t('ob.review.title')}>
        <ActivityIndicator color="#BFDCFF" />
      </StepShell>
    );
  }

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const missing = data.missingDocuments;

  return (
    <StepShell
      step={3 + offset}
      total={total}
      title={t('ob.review.title')}
      subtitle={t('ob.review.subtitle')}
      footer={
        <ShimmerButton
          label={t('ob.review.submit')}
          onPress={() => submit.mutate()}
          loading={submit.isPending}
          disabled={missing.length > 0 || !data.profileComplete}
        />
      }
    >
      <Row
        label={
          data.accountType === 'COMPANY' ? 'ob.type.company' : 'ob.type.individual'
        }
        value={fullName || '—'}
      />
      {data.companyName ? (
        <Row label="ob.companyName" value={data.companyName} />
      ) : null}
      {data.companyRegistrationNumber ? (
        <Row
          label="ob.companyRegistrationNumber"
          value={data.companyRegistrationNumber}
        />
      ) : null}
      {data.designation ? (
        <Row label="ob.designation" value={data.designation} />
      ) : null}
      <Row label="ob.address" value={data.address ?? '—'} />
      <Row
        label="ob.emailLabel"
        value={
          data.email
            ? `${data.email}${data.emailVerified ? ' ✓' : ` (${t('email.pending')})`}`
            : '—'
        }
      />

      <View style={styles.divider} />

      <Text style={[styles.sectionLabel, { color: c.textMutedOnBrand }]}>
        {t('ob.docs.title')}
      </Text>
      {data.documents.map((doc) => (
        <View key={doc.kind} style={styles.docRow}>
          <Text style={[styles.docCheck, { color: c.accentOnBrand }]}>✓</Text>
          <Text style={[styles.docName, { color: c.textOnBrand }]}>
            {t(`ob.doc.${doc.kind}` as TranslationKey)}
          </Text>
        </View>
      ))}

      {missing.length > 0 ? (
        <Text style={[styles.missing, { color: c.danger }]}>
          {t('ob.review.missing', {
            items: missing
              .map((k) => t(`ob.doc.${k}` as TranslationKey))
              .join(', '),
          })}
        </Text>
      ) : null}

      <ErrorBanner message={error} />
    </StepShell>
  );
}

function Row({ label, value }: { label: TranslationKey; value: string }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.textMutedOnBrand }]}>
        {t(label)}
      </Text>
      <Text style={[styles.rowValue, { color: c.textOnBrand }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12 },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowValue: { fontSize: 15, fontWeight: '600', marginTop: 3 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.10)',
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  docCheck: { fontSize: 13, fontWeight: '800' },
  docName: { fontSize: 13.5 },
  missing: { fontSize: 12.5, marginTop: 8, lineHeight: 18 },
});
