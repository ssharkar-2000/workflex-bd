import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  shortlistSchema,
  type MatchAxis,
  type Shortlist,
  type ShortlistCandidate,
} from '@workflex/shared';
import { api } from '../../../src/api/client';
import { decideApplication } from '../../../src/api/jobs';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { VideoPlayer } from '../../../src/components/VideoPlayer';
import { env } from '../../../src/lib/env';
import { useAuthStore } from '../../../src/store/auth-store';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

async function fetchShortlist(jobId: string): Promise<Shortlist> {
  const { data } = await api.get(`/jobs/${jobId}/shortlist`, { timeout: 90_000 });
  return shortlistSchema.parse(data);
}

/**
 * The AI shortlist for one posting.
 *
 * Six candidates out of however many applied, each with the percentage, the
 * five bars it is made of, a line for and a line against, and the CV and
 * intro video to open. The recruiter still decides — the Shortlist button
 * here is the same call the applicants screen makes, so a decision taken on
 * this screen shows up on that one and the other way round.
 *
 * The reservation is shown as prominently as the reason. That is deliberate:
 * a ranked list that only argues in favour trains a reader to stop checking
 * it, and the cost of that falls on the person who was passed over for a
 * question nobody asked.
 */
export default function ShortlistScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const shortlist = useQuery({
    queryKey: ['shortlist', jobId],
    queryFn: () => fetchShortlist(jobId),
    enabled: Boolean(jobId),
  });

  const decide = useMutation({
    mutationFn: (userId: string) => decideApplication(jobId, userId, 'SHORTLISTED'),
    onSuccess: (list) => {
      // The decide call hands back the whole applicant list, so the other
      // screen is updated rather than merely invalidated — a recruiter who
      // goes back should not watch a spinner to see what they just did.
      queryClient.setQueryData(['applicants', jobId], list);
      void queryClient.invalidateQueries({ queryKey: ['shortlist', jobId] });
    },
  });

  const data = shortlist.data;

  return (
    <MoneyScreen title={t('shortlist.title')} subtitle={data?.jobTitle ?? ''}>
      {shortlist.error ? (
        <ErrorBanner message={errorMessage(shortlist.error)} tone="onSurface" />
      ) : null}
      {decide.error ? (
        <ErrorBanner message={errorMessage(decide.error)} tone="onSurface" />
      ) : null}

      {shortlist.isLoading ? (
        <>
          <ActivityIndicator color={c.primary} style={s.loading} />
          <Text style={[s.note, { color: c.textMuted }]}>{t('shortlist.working')}</Text>
        </>
      ) : !data ? null : data.candidates.length === 0 ? (
        <Notice tone="info" title={t('shortlist.emptyTitle')} body={t('shortlist.emptyBody')} />
      ) : (
        <>
          <Text style={[s.count, { color: c.text }]}>
            {t('shortlist.outOf', {
              shown: data.candidates.length,
              considered: data.considered,
            })}
          </Text>
          <Notice tone="info" body={data.summary} />

          {data.withoutCv > 0 ? (
            <Notice tone="warning" body={t('shortlist.withoutCv', { n: data.withoutCv })} />
          ) : null}

          {data.candidates.map((person, i) => (
            <CandidateCard
              key={person.userId}
              rank={i + 1}
              person={person}
              jobId={jobId}
              onShortlist={() => decide.mutate(person.userId)}
              busy={decide.isPending}
            />
          ))}

          <Pressable
            onPress={() =>
              router.push({ pathname: '/(app)/applicants/[jobId]', params: { jobId } })
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              s.all,
              { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
            ]}
          >
            <Text style={[s.allText, { color: c.primary }]}>
              {t('shortlist.seeAll', { n: data.considered })}
            </Text>
          </Pressable>

          <Text style={[s.note, { color: c.textMuted }]}>{t('shortlist.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

function CandidateCard({
  rank,
  person,
  jobId,
  onShortlist,
  busy,
}: {
  rank: number;
  person: ShortlistCandidate;
  jobId: string;
  onShortlist: () => void;
  busy: boolean;
}) {
  const t = useT();
  const { c } = useTheme();
  const [cvError, setCvError] = useState(false);

  const already = person.status === 'SHORTLISTED' || person.status === 'ACCEPTED';

  /**
   * Same route the applicants screen uses, and the same reason for fetching
   * rather than linking: the endpoint is authenticated, so a plain link gets
   * a 401 and shows the recruiter nothing.
   */
  const openCv = async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(
        `${env.apiUrl}/jobs/${jobId}/applicants/${person.userId}/cv`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (!response.ok) throw new Error('cv');
      await Linking.openURL(URL.createObjectURL(await response.blob()));
      setCvError(false);
    } catch {
      setCvError(true);
    }
  };

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.head}>
        <Text style={[s.rank, { color: c.textMuted }]}>{rank}</Text>
        <View style={s.who}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
            {person.titles.length > 0 ? person.titles.join(', ') : t('shortlist.noTitles')}
            {person.yearsExperience !== null
              ? ` · ${t('shortlist.years', { n: person.yearsExperience })}`
              : ''}
          </Text>
        </View>
        <Text style={[s.score, { color: scoreColour(person.score, c) }]}>{person.score}%</Text>
      </View>

      {/* The five bars the percentage is made of. A number without its parts
          is one nobody can check or argue with. */}
      <View style={s.axes}>
        {person.axes.map((axis) => (
          <Axis key={axis.key} axis={axis} label={t(axisKey(axis.key))} />
        ))}
      </View>

      <Text style={[s.why, { color: c.text }]}>{person.why}</Text>
      <View style={[s.against, { backgroundColor: c.surfaceAlt }]}>
        <Text style={[s.againstLabel, { color: c.textMuted }]}>{t('shortlist.against')}</Text>
        <Text style={[s.againstBody, { color: c.text }]}>{person.reservation}</Text>
      </View>

      {person.matchedSkills.length > 0 ? (
        <Text style={[s.skills, { color: c.textMuted }]}>
          {t('shortlist.has')} {person.matchedSkills.join(', ')}
        </Text>
      ) : null}
      {person.missingSkills.length > 0 ? (
        <Text style={[s.skills, { color: c.textMuted }]}>
          {t('shortlist.lacks')} {person.missingSkills.join(', ')}
        </Text>
      ) : null}

      {person.message ? (
        <Text style={[s.message, { color: c.text }]}>“{person.message}”</Text>
      ) : null}

      {person.hasIntro ? (
        <View style={s.video}>
          <Text style={[s.videoLabel, { color: c.textMuted }]}>{t('shortlist.intro')}</Text>
          <VideoPlayer url={`${env.apiUrl}/jobs/${jobId}/applicants/${person.userId}/intro`} />
        </View>
      ) : null}

      <View style={s.actions}>
        {person.hasCv ? (
          <Pill label={t(cvError ? 'shortlist.cvFailed' : 'shortlist.openCv')} onPress={openCv} />
        ) : (
          <Text style={[s.noCv, { color: c.textMuted }]}>{t('shortlist.noCv')}</Text>
        )}
        {already ? (
          <Text style={[s.done, { color: c.success }]}>{t('shortlist.onList')}</Text>
        ) : (
          <Pill label={t('shortlist.add')} onPress={onShortlist} disabled={busy} filled />
        )}
      </View>
    </View>
  );
}

function Axis({ axis, label }: { axis: MatchAxis; label: string }) {
  const { c } = useTheme();
  const share = Math.round((axis.earned / axis.possible) * 100);
  return (
    <View style={s.axis}>
      <Text style={[s.axisLabel, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
        <View style={[s.fill, { backgroundColor: c.primary, width: `${share}%` }]} />
      </View>
    </View>
  );
}

function Pill({
  label,
  onPress,
  disabled,
  filled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.pill,
        {
          borderColor: c.primary,
          backgroundColor: filled ? c.primary : pressed ? c.primarySoft : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[s.pillText, { color: filled ? '#FFFFFF' : c.primary }]}>{label}</Text>
    </Pressable>
  );
}

function scoreColour(score: number, c: { success: string; warning: string; textMuted: string }) {
  return score >= 70 ? c.success : score >= 45 ? c.warning : c.textMuted;
}

/** The axis keys are stable; the labels are translated. */
function axisKey(key: MatchAxis['key']) {
  return (
    {
      skills: 'shortlist.axisSkills',
      experience: 'shortlist.axisExperience',
      cv: 'shortlist.axisCv',
      intro: 'shortlist.axisIntro',
      standing: 'shortlist.axisStanding',
    } as const
  )[key];
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.xs },
  count: { fontSize: font.sm, fontWeight: '800', marginTop: space.sm, marginBottom: space.xs },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rank: { fontSize: font.sm, fontWeight: '900', width: 16 },
  who: { flex: 1 },
  name: { fontSize: font.sm + 1, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 1 },
  score: { fontSize: font.lg, fontWeight: '900' },

  axes: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  axis: { flex: 1 },
  axisLabel: { fontSize: font.xs - 3, fontWeight: '700', marginBottom: 3 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },

  why: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.sm },
  against: {
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    marginTop: space.xs,
  },
  againstLabel: { fontSize: font.xs - 2, fontWeight: '800', letterSpacing: 0.4 },
  againstBody: { fontSize: font.xs + 1, lineHeight: 18, marginTop: 2 },

  skills: { fontSize: font.xs, lineHeight: 16, marginTop: space.xs },
  message: { fontSize: font.xs + 1, fontStyle: 'italic', lineHeight: 18, marginTop: space.xs },

  video: { marginTop: space.sm },
  videoLabel: { fontSize: font.xs - 1, fontWeight: '800', marginBottom: 4 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.md,
  },
  noCv: { fontSize: font.xs, fontWeight: '700' },
  done: { fontSize: font.xs, fontWeight: '800' },

  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  pillText: { fontSize: font.xs, fontWeight: '800' },

  all: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    marginTop: space.md,
  },
  allText: { fontSize: font.xs, fontWeight: '800' },
});
