import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  const [sentNotice, setSentNotice] = useState(false);
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
      // Confirms where the document went and what happens next. A tile that
      // silently turns green says the upload worked but not that a person will
      // now read it, which is the part someone waiting actually needs to know.
      setSentNotice(true);
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

  // The same three for everyone. A trade licence is offered below as an
  // optional extra, not counted here — it unlocks posting jobs as a company
  // and must never block someone from finishing registration.
  const needed = requiredDocuments();
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
      <SentNotice visible={sentNotice} onDismiss={() => setSentNotice(false)} />

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

      {/* Offered, never required. A trade licence is what unlocks posting
          jobs as a company once an admin has checked it; someone who only
          wants to find work never needs one, and it must not stand between
          them and finishing registration. */}
      <View style={[styles.optionalHead, { borderTopColor: c.glassBorder }]}>
        <Text style={[styles.optionalTitle, { color: c.textOnBrand }]}>
          {t('ob.doc.optionalTitle')}
        </Text>
        <Text style={[styles.optionalBody, { color: c.textMutedOnBrand }]}>
          {t('ob.doc.optionalBody')}
        </Text>
      </View>

      <DocumentTile
        kind="TRADE_LICENSE"
        uploaded={have.has('TRADE_LICENSE')}
        uploading={busyKind === 'TRADE_LICENSE'}
        analysis={byKind.get('TRADE_LICENSE')?.analysis ?? null}
        onPicked={(file) => upload.mutate({ kind: 'TRADE_LICENSE', file })}
      />

      <ErrorBanner message={error} />

      <View style={styles.counter}>
        <Text style={[styles.counterText, { color: c.textMutedOnBrand }]}>
          {/* Counts only the required set, so an uploaded licence cannot make
              the tally read 4 / 3. */}
          {needed.filter((k) => have.has(k)).length} / {needed.length}{' '}
          {t('ob.doc.uploaded').toLowerCase()}
        </Text>
      </View>
    </StepShell>
  );
}

/**
 * Confirms that an upload reached the review team.
 *
 * Shown in the page rather than as a modal on purpose: it appears after every
 * upload, and three documents means three interruptions if each one has to be
 * dismissed before the next can be started. Sitting above the tiles it can be
 * read or ignored, and it stays until dismissed so it cannot be missed either.
 */
function SentNotice({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: c.successSoft, borderColor: c.success },
      ]}
      accessibilityRole="alert"
    >
      <Text style={[styles.noticeTitle, { color: c.success }]}>
        ✓ {t('ob.doc.sentTitle')}
      </Text>
      <Text style={[styles.noticeBody, { color: c.text }]}>
        {t('ob.doc.sentBody')}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.noticeDismiss, { color: c.success }]}>
          {t('ob.doc.sentDismiss')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  noticeTitle: { fontSize: 14, fontWeight: '800' },
  noticeBody: { fontSize: 12.5, lineHeight: 18 },
  noticeDismiss: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  optionalHead: {
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 16,
    marginBottom: 12,
  },
  optionalTitle: { fontSize: 15, fontWeight: '800' },
  optionalBody: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },

  counter: { alignItems: 'center', marginTop: 8 },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
