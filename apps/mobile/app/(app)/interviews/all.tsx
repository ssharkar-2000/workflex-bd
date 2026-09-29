import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Interview,
  InterviewFilter,
  InterviewList,
  InterviewSide,
} from '@workflex/shared';
import { fetchInterviews, respondToInterview } from '../../../src/api/interviews';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * "All" is last and exists for one reason: an interview whose time passed
 * with nobody marking it matches none of the others — not upcoming, not
 * today, not completed, not cancelled. Without this chip the calendar could
 * send somebody here to look at a missed interview and land them on a list
 * that does not contain it.
 */
const FILTERS: InterviewFilter[] = [
  'UPCOMING',
  'TODAY',
  'AWAITING',
  'COMPLETED',
  'CANCELLED',
  'ALL',
];

/**
 * Every interview, filtered — the answer to "what have I got coming up".
 *
 * The day view at /(app)/interviews answers a different question ("what is
 * on now, and how do I get in"), asked at a different moment. This is the
 * one that holds the decisions: accepting an invitation, declining it, and
 * looking back at what has already happened.
 *
 * "Attending" is what somebody was invited to; "hosting" is what they
 * arranged. One screen rather than two, for the same reason the shifts
 * screen is one: the same person does both, often about the same week.
 */
export default function AllInterviewsScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  /**
   * The calendar and the day view both link here and say what to show.
   * Only the starting tabs come from the link — after that the chips are
   * the person's own, and a refetch must not drag them back.
   */
  const params = useLocalSearchParams<{ side?: string; filter?: string }>();
  const [side, setSide] = useState<InterviewSide>(
    params.side === 'HOSTING' ? 'HOSTING' : 'ATTENDING',
  );
  const [filter, setFilter] = useState<InterviewFilter>(
    FILTERS.includes(params.filter as InterviewFilter)
      ? (params.filter as InterviewFilter)
      : 'UPCOMING',
  );

  const query = useQuery({
    queryKey: ['interviews', side, filter],
    queryFn: () => fetchInterviews(side, filter),
  });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToInterview(id, { accept }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interviews'] });
      void queryClient.invalidateQueries({ queryKey: ['interview-day'] });
    },
  });

  const data: InterviewList | undefined = query.data;

  return (
    <MoneyScreen title={t('interviews.title')} subtitle={t(`interviews.side.${side}`)}>
      {/* Which end of the table you are sitting at. */}
      <View style={s.sides}>
        {(['ATTENDING', 'HOSTING'] as InterviewSide[]).map((one) => (
          <Pressable
            key={one}
            onPress={() => setSide(one)}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.side,
              {
                backgroundColor: side === one ? c.primary : pressed ? c.surfaceAlt : c.surface,
                borderColor: side === one ? c.primary : c.border,
              },
            ]}
          >
            <Text
              style={[s.sideText, { color: side === one ? '#FFFFFF' : c.textMuted }]}
              numberOfLines={1}
            >
              {t(`interviews.side.${one}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.chips}>
        {FILTERS.map((one) => (
          <Pressable
            key={one}
            onPress={() => setFilter(one)}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.chip,
              {
                backgroundColor:
                  filter === one ? c.primarySoft : pressed ? c.surfaceAlt : 'transparent',
                borderColor: filter === one ? c.primary : c.border,
              },
            ]}
          >
            <Text
              style={[s.chipText, { color: filter === one ? c.primary : c.textMuted }]}
            >
              {t(`interviews.filter.${one}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {query.error ? (
        <ErrorBanner message={errorMessage(query.error)} tone="onSurface" />
      ) : null}
      {respond.error ? (
        <ErrorBanner message={errorMessage(respond.error)} tone="onSurface" />
      ) : null}

      {query.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (data?.interviews.length ?? 0) === 0 ? (
        <Text style={[s.empty, { color: c.textMuted }]}>
          {t(`interviews.empty.${side}` as TranslationKey)}
        </Text>
      ) : (
        data!.interviews.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            side={side}
            onRespond={(accept) => respond.mutate({ id: interview.id, accept })}
            busy={respond.isPending}
          />
        ))
      )}
    </MoneyScreen>
  );
}

function InterviewCard({
  interview,
  side,
  onRespond,
  busy,
}: {
  interview: Interview;
  side: InterviewSide;
  onRespond: (accept: boolean) => void;
  busy: boolean;
}) {
  const t = useT();
  const { c } = useTheme();

  const when = new Date(interview.scheduledAt);
  const other =
    side === 'HOSTING'
      ? interview.candidate.name
      : interview.employer.company ?? interview.employer.name;

  /** Only the person invited answers, and only while the answer still counts. */
  const canAnswer =
    side === 'ATTENDING' &&
    (interview.status === 'SCHEDULED' || interview.status === 'RESCHEDULED');

  const tone =
    interview.status === 'ACCEPTED'
      ? c.success
      : interview.status === 'DECLINED' || interview.status === 'CANCELLED'
        ? c.danger
        : c.textMuted;

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.cardTop}>
        <Text style={[s.title, { color: c.text }]} numberOfLines={1}>
          {interview.job.title}
        </Text>
        <Text style={[s.status, { color: tone }]} numberOfLines={1}>
          {t(`interviews.status.${interview.status}` as TranslationKey)}
        </Text>
      </View>

      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
        {t('interviews.with', { name: other })}
      </Text>
      <Text style={[s.meta, { color: c.textMuted }]}>
        {when.toLocaleString()} ·{' '}
        {t('interviews.minutes', { count: interview.durationMinutes })} ·{' '}
        {t(`interviews.mode.${interview.mode}` as TranslationKey)}
      </Text>

      {interview.location ? (
        <Text style={[s.meta, { color: c.textMuted }]}>{interview.location}</Text>
      ) : null}
      {interview.notes ? (
        <Text style={[s.notes, { color: c.text }]}>{interview.notes}</Text>
      ) : null}
      {interview.declineReason ? (
        <Text style={[s.notes, { color: c.danger }]}>{interview.declineReason}</Text>
      ) : null}
      {interview.cancelReason ? (
        <Text style={[s.notes, { color: c.danger }]}>{interview.cancelReason}</Text>
      ) : null}
      {interview.outcome ? (
        <Text style={[s.notes, { color: c.text }]}>{interview.outcome}</Text>
      ) : null}

      <View style={s.actions}>
        {interview.meetingUrl ? (
          <Pill
            label={t('interviews.join')}
            onPress={() => void Linking.openURL(interview.meetingUrl!).catch(() => {})}
          />
        ) : null}

        {canAnswer ? (
          <>
            <Pill label={t('interviews.accept')} onPress={() => onRespond(true)} disabled={busy} filled />
            <Pill label={t('interviews.decline')} onPress={() => onRespond(false)} disabled={busy} danger />
          </>
        ) : null}
      </View>
    </View>
  );
}

function Pill({
  label,
  onPress,
  disabled,
  filled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const ink = danger ? c.danger : filled ? '#FFFFFF' : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.pill,
        {
          borderColor: danger ? c.dangerBorder : c.primary,
          backgroundColor: filled ? c.primary : pressed ? c.primarySoft : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[s.pillText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  empty: { fontSize: font.sm, lineHeight: 20, marginTop: space.lg, textAlign: 'center' },

  sides: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  side: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 9,
    alignItems: 'center',
  },
  sideText: { fontSize: font.xs + 1, fontWeight: '800' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: space.md },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  chipText: { fontSize: font.xs, fontWeight: '700' },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  title: { flex: 1, fontSize: font.sm + 1, fontWeight: '800' },
  status: { fontSize: font.xs, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 3 },
  notes: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.xs },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  pillText: { fontSize: font.xs, fontWeight: '800' },
});
