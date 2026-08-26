import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requiredDocuments, type DocumentKind } from '@workflex/shared';
import { StepShell } from '../../src/components/onboarding/StepShell';
import { DocumentTile } from '../../src/components/onboarding/DocumentTile';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import {
  fetchOnboardingStatus,
  uploadDocument,
} from '../../src/api/onboarding';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { useStepCount } from '../../src/lib/onboarding-steps';

export default function DocumentsScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<DocumentKind | null>(null);
  const { total, offset } = useStepCount();
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
    // The checks run after the upload responds, so poll while any are in
    // flight and stop as soon as they all have a verdict.
    refetchInterval: (query) => {
      const pending = query.state.data?.documents.some(
        (d) =>
          d.analysis?.status === 'QUEUED' || d.analysis?.status === 'RUNNING',
      );
      return pending ? 2000 : false;
    },
  });

  const upload = useMutation({
    mutationFn: (args: {
      kind: DocumentKind;
      file: { uri: string; name: string; type: string };
    }) => uploadDocument(args.kind, args.file),
    onMutate: (args) => {
      setBusyKind(args.kind);
      setError(null);
    },
    onSuccess: (status, args) => {
      queryClient.setQueryData(['onboarding-status'], status);
      // The dashboard avatar is the selfie, and /me carries the flag saying
      // one exists — without this the photo only appears after a cold start.
      if (args.kind === 'SELFIE') {
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
    onError: (err) => setError(errorMessage(err)),
    onSettled: () => setBusyKind(null),
  });

  if (isLoading || !data) {
    return (
      <StepShell step={3 + offset} total={total} title={t('ob.docs.title')}>
        <ActivityIndicator color="#BFDCFF" />
      </StepShell>
    );
  }

  const needed = data.accountType
    ? requiredDocuments(data.accountType)
    : requiredDocuments('INDIVIDUAL');
  const have = new Set(data.documents.map((d) => d.kind));
  const byKind = new Map(data.documents.map((d) => [d.kind, d]));
  const complete = needed.every((k) => have.has(k));

  // A photo the checks call unreadable is blocked here rather than wasting a
  // reviewer's time and coming back as a rejection a day later.
  const blocked = data.documents.some((d) => d.analysis?.status === 'FAILED');

  return (
    <StepShell
      step={3 + offset}
      total={total}
      title={t('ob.docs.title')}
      subtitle={t('ob.docs.subtitle')}
      footer={
        <ShimmerButton
          label={t('ob.continue')}
          disabled={!complete || blocked}
          onPress={() => router.push('/(onboarding)/review')}
        />
      }
    >
      {needed.map((kind) => (
        <DocumentTile
          key={kind}
          kind={kind}
          uploaded={have.has(kind)}
          uploading={busyKind === kind}
          analysis={byKind.get(kind)?.analysis ?? null}
          onPicked={(file) => upload.mutate({ kind, file })}
        />
      ))}

      <ErrorBanner message={error} />

      <View style={styles.counter}>
        <Text style={[styles.counterText, { color: c.textMutedOnBrand }]}>
          {have.size} / {needed.length} {t('ob.doc.uploaded').toLowerCase()}
        </Text>
      </View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  counter: { alignItems: 'center', marginTop: 8 },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
