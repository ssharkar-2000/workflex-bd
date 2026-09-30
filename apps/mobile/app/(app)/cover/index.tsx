import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  formatTaka,
  type CoverGap,
  type HireGroup,
  type HirePerson,
  type JobStaffing,
} from '@workflex/shared';
import { fetchGaps } from '../../../src/api/cover';
import { fetchHires } from '../../../src/api/hires';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { UnavailableForm } from '../../../src/components/hires/UnavailableForm';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * The Replacement Matcher, first screen.
 *
 * Two kinds of gap, in the order somebody would act on them:
 *
 *  1. Hired workers who cannot continue — flagged unavailable by themselves or
 *     by the employer, still waiting for somebody to take their place. Below
 *     them, everyone else who is hired and working, each with the one action
 *     that starts this flow: "Worker unavailable?".
 *  2. Shifts somebody cancelled and nobody is covering, soonest first. The
 *     ordering is the point — a shift starting in six hours and one starting in
 *     three weeks are not the same problem, and the screen should not make the
 *     employer work out which is which.
 */
export default function CoverGapsScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const gaps = useQuery({ queryKey: ['cover', 'gaps'], queryFn: fetchGaps });
  const hires = useQuery({ queryKey: ['hires', 'RECRUITER'], queryFn: () => fetchHires('RECRUITER') });
  const rows = gaps.data?.gaps ?? [];
  const open = rows.filter((gap) => !gap.covered);
  const filled = rows.filter((gap) => gap.covered);

  // Everyone hired and still on the job, and who among them cannot continue.
  const groups = hires.data?.groups ?? [];
  const needing = groups.flatMap((group) =>
    group.people.filter((person) => person.unavailable && !person.completedAt).map((person) => ({ group, person })),
  );
  const working = groups
    .map((group) => ({
      group,
      people: group.people.filter((person) => !person.unavailable && !person.completedAt),
    }))
    .filter((entry) => entry.people.length > 0);

  const loading = gaps.isLoading || hires.isLoading;
  const nothing = rows.length === 0 && groups.length === 0;

  const openMatcher = (jobId: string, person: HirePerson) =>
    router.push({
      pathname: '/(app)/cover/job/[jobId]',
      params: { jobId, workerId: person.userId, name: person.name },
    });

  return (
    <MoneyScreen
      title={t('cover.title')}
      subtitle={t('cover.subtitle')}
      refreshing={gaps.isRefetching || hires.isRefetching}
      onRefresh={() => {
        void gaps.refetch();
        void hires.refetch();
      }}
    >
      {gaps.error ? <ErrorBanner message={errorMessage(gaps.error)} tone="onSurface" /> : null}
      {hires.error ? <ErrorBanner message={errorMessage(hires.error)} tone="onSurface" /> : null}

      {loading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : nothing ? (
        <Notice tone="success" title={t('cover.noneTitle')} body={t('cover.noneBody')} />
      ) : (
        <>
          {/* Hired workers who cannot continue: the reason this screen exists. */}
          {needing.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]} testID="needs-heading">
                {t('cover.needsTitle')} ({needing.length})
              </Text>
              {needing.map(({ group, person }) => (
                <NeedsCard
                  key={`${group.job.id}:${person.userId}`}
                  group={group}
                  person={person}
                  onOpen={() => openMatcher(group.job.id, person)}
                />
              ))}
            </>
          ) : null}

          <Text style={[s.heading, { color: c.text }]}>{t('cover.hiredTitle')}</Text>
          <Text style={[s.note, s.hint, { color: c.textMuted }]}>{t('cover.hiredHint')}</Text>
          {working.length === 0 ? (
            <Notice tone="info" body={t('cover.noHired')} />
          ) : (
            working.map(({ group, people }) => (
              <HiredJobCard
                key={group.job.id}
                group={group}
                people={people}
                onFlagged={(person) => openMatcher(group.job.id, person)}
              />
            ))
          )}

          {rows.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('cover.gapsTitle')}</Text>
              {open.length === 0 ? (
                <Notice tone="success" title={t('cover.allCovered')} />
              ) : (
                open.map((gap) => (
                  <GapCard
                    key={gap.shiftId}
                    gap={gap}
                    onPress={() =>
                      router.push({ pathname: '/(app)/cover/[id]', params: { id: gap.shiftId } })
                    }
                  />
                ))
              )}

              {filled.length > 0 ? (
                <>
                  <Text style={[s.heading, { color: c.text }]}>{t('cover.filled')}</Text>
                  {filled.map((gap) => (
                    <GapCard key={gap.shiftId} gap={gap} />
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {/* What the ranking on a cancelled shift means: only relevant when there is one. */}
      {rows.length > 0 ? <Text style={[s.note, { color: c.textMuted }]}>{t('cover.footnote')}</Text> : null}
    </MoneyScreen>
  );
}

/** A hired worker who cannot continue, and the button that goes and finds somebody. */
function NeedsCard({
  group,
  person,
  onOpen,
}: {
  group: HireGroup;
  person: HirePerson;
  onOpen: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const flag = person.unavailable!;

  return (
    <View
      style={[s.card, { backgroundColor: c.surface, borderColor: c.danger }]}
      testID={`needs-${person.publicId}`}
    >
      <View style={s.cardTop}>
        <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>
          {group.job.title}
        </Text>
        <StaffingPill staffing={group.staffing} />
      </View>
      <Text style={[s.meta, { color: c.text }]} numberOfLines={1}>
        {person.name} · {person.publicId}
      </Text>
      <Text style={[s.reason, { color: c.danger }]}>
        {t('repl.flagged', { reason: t(`repl.reason.${flag.reason}` as TranslationKey) })}
        {' · '}
        {t(`repl.flaggedBy${flag.by}` as TranslationKey)}
      </Text>
      {flag.note ? (
        <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={2}>
          “{flag.note}”
        </Text>
      ) : null}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        testID={`open-matcher-${person.publicId}`}
        style={({ pressed }) => [
          s.action,
          { backgroundColor: pressed ? c.primaryPressed : c.primary },
        ]}
      >
        <Text style={[s.actionText, { color: c.primaryText }]}>{t('cover.findReplacement')}</Text>
      </Pressable>
    </View>
  );
}

/** One job and the people working it, each with "Worker unavailable?". */
function HiredJobCard({
  group,
  people,
  onFlagged,
}: {
  group: HireGroup;
  people: HirePerson[];
  onFlagged: (person: HirePerson) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View
      style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
      testID={`hired-job-${group.job.id}`}
    >
      <View style={s.cardTop}>
        <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>
          {group.job.title}
        </Text>
        <StaffingPill staffing={group.staffing} />
      </View>
      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
        {group.job.location}
      </Text>

      {people.map((person) => (
        <View key={person.userId} style={[s.person, { borderTopColor: c.border }]}>
          <View style={s.cardTop}>
            <View style={s.grow}>
              <Text style={[s.personName, { color: c.text }]} numberOfLines={1}>
                {person.name}
              </Text>
              <Text style={[s.meta, { color: c.textMuted }]}>
                {person.publicId} · {t('repl.working')}
              </Text>
            </View>
            {openId === person.userId ? null : (
              <Pressable
                onPress={() => setOpenId(person.userId)}
                accessibilityRole="button"
                testID={`mark-${person.publicId}`}
                style={[s.small, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}
              >
                <Text style={[s.smallText, { color: c.text }]}>{t('repl.markUnavailable')}</Text>
              </Pressable>
            )}
          </View>
          {openId === person.userId ? (
            <UnavailableForm
              jobId={group.job.id}
              workerId={person.userId}
              workerName={person.name}
              side="RECRUITER"
              onCancel={() => setOpenId(null)}
              onDone={() => {
                setOpenId(null);
                onFlagged(person);
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** How full the job is, as a coloured word. Silent while nobody has been hired. */
function StaffingPill({ staffing }: { staffing: JobStaffing }) {
  const t = useT();
  const { c } = useTheme();
  if (staffing === 'RECRUITING') return null;
  const [bg, fg] =
    staffing === 'NEEDS_REPLACEMENT'
      ? [c.dangerSoft, c.danger]
      : staffing === 'FILLED'
        ? [c.successSoft, c.success]
        : [c.warningSoft, c.warning];
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{t(`staffing.${staffing}` as TranslationKey)}</Text>
    </View>
  );
}

function GapCard({ gap, onPress }: { gap: CoverGap; onPress?: () => void }) {
  const t = useT();
  const { c } = useTheme();

  /**
   * Three bands rather than a countdown: the employer needs to know whether
   * this is tonight's problem or next week's, and a live-ticking number would
   * be precision about something nobody acts on to the minute.
   */
  const urgency = gap.covered
    ? { tone: c.textMuted, label: t('cover.covered') }
    : gap.hoursUntil < 0
      ? { tone: c.danger, label: t('cover.started') }
      : gap.hoursUntil < 24
        ? { tone: c.danger, label: t('cover.hours', { n: Math.max(1, Math.round(gap.hoursUntil)) }) }
        : { tone: c.textMuted, label: t('cover.days', { n: Math.round(gap.hoursUntil / 24) }) };

  const when = new Date(gap.startsAt);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: pressed && onPress ? c.surfaceAlt : c.surface,
          borderColor: gap.covered ? c.border : urgency.tone,
          opacity: gap.covered ? 0.7 : 1,
        },
      ]}
    >
      <View style={s.cardTop}>
        <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>
          {gap.jobTitle}
        </Text>
        <Text style={[s.urgency, { color: urgency.tone }]}>{urgency.label}</Text>
      </View>

      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
        {when.toLocaleString()} · {gap.location}
      </Text>
      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
        {t('cover.cancelledBy', { name: gap.workerName })} · {formatTaka(Math.round(gap.pay / 100))}
      </Text>

      {gap.cancelReason ? (
        <Text style={[s.reason, { color: c.text }]} numberOfLines={2}>
          “{gap.cancelReason}”
        </Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  loading: { marginTop: space.lg },
  action: {
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: space.sm,
  },
  actionText: { fontSize: font.sm + 1, fontWeight: '800' },
  person: { borderTopWidth: 1, marginTop: space.sm, paddingTop: space.sm },
  personName: { fontSize: font.sm + 1, fontWeight: '800' },
  small: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  smallText: { fontSize: font.xs, fontWeight: '800' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: font.xs, fontWeight: '800' },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.md },
  hint: { marginTop: 4, marginBottom: space.xs },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, fontSize: font.sm + 1, fontWeight: '800' },
  urgency: { fontSize: font.xs, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 3 },
  reason: { fontSize: font.xs + 1, fontStyle: 'italic', marginTop: space.xs },
});
