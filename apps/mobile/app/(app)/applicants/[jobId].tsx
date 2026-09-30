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
import { VideoPlayer } from '../../../src/components/VideoPlayer';
import { env } from '../../../src/lib/env';
import { useAuthStore } from '../../../src/store/auth-store';
import { Card, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space, type Palette } from '../../../src/lib/theme';

type Decision = DecideApplicationDto['status'];

/** Same dots as the applicant's own list, so a status reads the same either side. */
const STATUS_TONE: Record<ApplicationStatus, 'info' | 'warn' | 'good' | 'mute'> = {
  SUBMITTED: 'info',
  VIEWED: 'warn',
  SHORTLISTED: 'good',
  ACCEPTED: 'good',
  REJECTED: 'mute',
  WITHDRAWN: 'mute',
};

/** The dot's colour, from the theme rather than from a font. */
function statusColour(status: ApplicationStatus, c: Palette): string {
  const tone = STATUS_TONE[status];
  return tone === 'good' ? c.success : tone === 'warn' ? c.warning : tone === 'info' ? c.primary : c.textMuted;
}

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
  /** Which applicant's introduction is playing. One at a time. */
  const [watching, setWatching] = useState<string | null>(null);

  /**
   * A CV is a file, and files are opened by whatever opens files.
   *
   * It comes from an authenticated endpoint, so it is fetched with the token
   * and handed over as a local blob rather than linked to — a plain link
   * would get a 401 and show the recruiter nothing.
   */
  const openCv = async (userId: string) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${env.apiUrl}/jobs/${jobId}/applicants/${userId}/cv`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (!response.ok) throw new Error('cv');
      await Linking.openURL(URL.createObjectURL(await response.blob()));
    } catch {
      setError(t('applicants.noCv'));
    }
  };

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

      {/*
        The way into the ranked shortlist, above the unsorted list rather
        than below it. Forty applications is where a recruiter stops reading
        properly, so the offer to rank them has to arrive before the reading
        starts, not after they have scrolled past it.
      */}
      {data && data.applicants.length > 1 ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/(app)/shortlist/[jobId]', params: { jobId } })
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.aiShortlist,
            {
              borderColor: c.primary,
              backgroundColor: pressed ? c.primarySoft : c.surface,
            },
          ]}
        >
          <Text style={[styles.aiShortlistText, { color: c.primary }]}>
            {t('shortlist.open')}
          </Text>
          <Text style={[styles.aiShortlistHint, { color: c.textMuted }]}>
            {t('shortlist.openHint')}
          </Text>
        </Pressable>
      ) : null}

      {query.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : data && data.applicants.length === 0 ? (
        <View style={styles.empty}>
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
            jobId={jobId}
            watching={watching}
            setWatching={setWatching}
            onOpenCv={() => openCv(applicant.userId)}
            onOpenCredentials={() =>
              router.push({
                pathname: '/(app)/trustchain',
                params: { jobId, userId: applicant.userId, name: applicant.name },
              })
            }
            busy={decide.isPending && decide.variables?.userId === applicant.userId}
            onDecide={(status) => decide.mutate({ userId: applicant.userId, status })}
            onInterview={() =>
              router.push({
                pathname: '/(app)/interviews/schedule',
                params: {
                  jobId,
                  candidateId: applicant.userId,
                  candidateName: applicant.name,
                },
              })
            }
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
  jobId,
  watching,
  setWatching,
  onOpenCv,
  onOpenCredentials,
  onDecide,
  onPay,
  onInterview,
}: {
  applicant: Applicant;
  locale: Locale;
  busy: boolean;
  jobId: string;
  /** The one video open at a time; two playing at once is nobody's intent. */
  watching: string | null;
  setWatching: (userId: string | null) => void;
  onOpenCv: () => void;
  onOpenCredentials: () => void;
  onDecide: (status: Decision) => void;
  onPay: () => void;
  onInterview: () => void;
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
        <View style={[styles.statusDot, { backgroundColor: statusColour(status, c) }]} />
        <Text style={[styles.status, { color: c.textMuted }]}>
          {t(`app.status.${status}` as TranslationKey)}
        </Text>
      </View>

      {applicant.message ? (
        <Text style={[styles.message, { color: c.text, borderLeftColor: c.border }]}>
          “{applicant.message}”
        </Text>
      ) : null}

      {/* What there is to look at before deciding. The video first: it is
          the one a recruiter with thirty applicants actually opens. */}
      {applicant.hasIntro || applicant.hasCv ? (
        <View style={styles.attachments}>
          {applicant.hasIntro ? (
            <Pressable
              onPress={() => setWatching(watching ? null : applicant.userId)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.attachment,
                {
                  borderColor: c.primary,
                  backgroundColor: pressed || watching ? c.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[styles.attachmentText, { color: c.primary }]}>
                {t('applicants.watchIntro')}
              </Text>
            </Pressable>
          ) : null}

          {applicant.hasCv ? (
            <Pressable
              onPress={onOpenCv}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.attachment,
                {
                  borderColor: c.primarySoftBorder,
                  backgroundColor: pressed ? c.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[styles.attachmentText, { color: c.primary }]}>
                {t('applicants.viewCv')}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.noCv, { color: c.textMuted }]}>
              {t('applicants.noCv')}
            </Text>
          )}

          {/*
            The one-click check that replaces telephoning a university. Sits
            beside the CV rather than replacing it: a CV is what somebody
            says about themselves, and this is the part an institution has
            signed for — a recruiter wants both, in that order.
          */}
          <Pressable
            onPress={onOpenCredentials}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.attachment,
              {
                borderColor: c.primarySoftBorder,
                backgroundColor: pressed ? c.primarySoft : 'transparent',
              },
            ]}
          >
            <Text style={[styles.attachmentText, { color: c.primary }]}>
              {t('chain.checkCredentials')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {watching === applicant.userId ? (
        <VideoPlayer url={`${env.apiUrl}/jobs/${jobId}/applicants/${applicant.userId}/intro`} />
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
                <Text style={[styles.phone, { color: c.primary }]}>{applicant.phone}</Text>
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
            <SmallButton label={t('applicants.interview')} onPress={onInterview} />
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
  attachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  attachment: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  attachmentText: { fontSize: 12, fontWeight: '800' },
  noCv: { fontSize: 12 },

  loading: { marginTop: space.lg },
  flex: { flex: 1 },
  faded: { opacity: 0.72 },

  viewPosting: { alignSelf: 'flex-start', marginTop: 8 },
  viewPostingText: { fontSize: font.sm, fontWeight: '800' },

  aiShortlist: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    marginTop: space.md,
  },
  aiShortlistText: { fontSize: font.sm + 1, fontWeight: '800' },
  aiShortlistHint: { fontSize: font.xs, marginTop: 2 },

  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: font.md, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: radius.pill, marginRight: 6 },
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
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: 6 },
});
