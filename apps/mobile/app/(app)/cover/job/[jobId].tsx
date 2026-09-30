import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiErrorCode,
  type ExcludedCandidate,
  type HireCandidate,
  type ReplacementAssigned,
} from '@workflex/shared';
import { toApiError } from '../../../../src/api/client';
import { assignReplacement, fetchReplacementOptions } from '../../../../src/api/replacement';
import { UnavailableForm } from '../../../../src/components/hires/UnavailableForm';
import { Card, MoneyScreen, Notice, OutlineButton } from '../../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../../src/lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../../../src/i18n';
import { useTheme } from '../../../../src/lib/use-theme';
import { font, radius, space } from '../../../../src/lib/theme';

/**
 * The Replacement Matcher for one hired worker who cannot continue.
 *
 *     the worker being replaced -> eligible shortlisted candidates
 *                               -> pick one -> Assign as Replacement -> confirm
 *
 * The list comes from the server and is judged again there when somebody is
 * assigned, so what is shown here is a convenience, never the rule: a
 * candidate who took another shift while this screen was open is refused, and
 * the list is refreshed.
 */
export default function ReplacementMatcherScreen() {
  const { jobId, workerId, name } = useLocalSearchParams<{
    jobId: string;
    workerId: string;
    /** The worker's name, when the screen that sent us here already knew it. */
    name?: string;
  }>();
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const client = useQueryClient();

  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showLeftOut, setShowLeftOut] = useState(false);
  const [done, setDone] = useState<ReplacementAssigned | null>(null);

  const options = useQuery({
    queryKey: ['replacement', jobId, workerId],
    queryFn: () => fetchReplacementOptions(jobId!, workerId!),
    // Off once somebody has been assigned: the place is taken, so asking again
    // would only be told so. What was on screen is kept for the confirmation.
    enabled: Boolean(jobId && workerId) && !done,
    retry: false,
  });
  const data = options.data;

  const assign = useMutation({
    mutationFn: () => assignReplacement(jobId!, workerId!, selected!),
    onSuccess: (result) => {
      setConfirming(false);
      setDone(result);
      void client.invalidateQueries({ queryKey: ['hires'] });
      void client.invalidateQueries({ queryKey: ['my-jobs'] });
      // Other workers' lists on this job have lost a candidate; this worker's
      // own list is done with, and asking it again would only be told so.
      void client.invalidateQueries({
        queryKey: ['replacement'],
        predicate: (query) => query.queryKey[2] !== workerId,
      });
      void client.invalidateQueries({ queryKey: ['cover'] });
      void client.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: () => {
      // Whatever went wrong, the list on screen is out of date: draw it again.
      setConfirming(false);
      setSelected(null);
      void options.refetch();
    },
  });

  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    });

  // --- success ---

  if (done) {
    return (
      <MoneyScreen title={t('repl.title')}>
        <Card style={s.doneCard}>
          <View style={[s.tick, { backgroundColor: c.successSoft }]}>
            <Text style={[s.tickText, { color: c.success }]}>✓</Text>
          </View>
          <Text style={[s.doneTitle, { color: c.text }]} testID="done-title">
            {t('repl.doneTitle', { name: done.replacement.name })}
          </Text>
          <Text style={[s.doneBody, { color: c.textMuted }]}>
            {t('repl.doneBody', {
              name: done.replacement.name,
              old: done.replaced.name,
              job: data?.job.title ?? '',
            })}
          </Text>
          {done.movedShifts > 0 ? (
            <Text style={[s.doneBody, { color: c.text }]}>
              {t('repl.doneShifts', { n: done.movedShifts, name: done.replacement.name })}
            </Text>
          ) : null}
          <Text style={[s.doneBody, { color: c.text }]} selectable>
            {done.replacement.phone}
          </Text>
          <View style={[s.status, { backgroundColor: c.successSoft }]}>
            <Text style={[s.statusText, { color: c.success }]} testID="done-status">
              {t('repl.doneStatus', {
                status: t(`staffing.${done.staffing}` as TranslationKey),
              })}
            </Text>
          </View>
        </Card>
        <View style={s.stack}>
          <Pressable
            onPress={() => router.replace('/(app)/hired')}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.primary,
              { backgroundColor: pressed ? c.primaryPressed : c.primary },
            ]}
          >
            <Text style={[s.primaryText, { color: c.primaryText }]}>{t('repl.doneHired')}</Text>
          </Pressable>
          <OutlineButton label={t('repl.doneBack')} onPress={() => router.replace('/(app)/cover')} />
        </View>
      </MoneyScreen>
    );
  }

  // --- loading and problems ---

  if (options.isLoading || !jobId || !workerId) {
    return (
      <MoneyScreen title={t('repl.title')} subtitle={t('repl.subtitle')}>
        <ActivityIndicator color={c.primary} style={s.loading} />
      </MoneyScreen>
    );
  }

  if (!data) {
    const code = options.error ? toApiError(options.error).code : null;

    // Somebody opened this without the worker having been flagged first.
    if (code === ApiErrorCode.HIRE_NOT_UNAVAILABLE) {
      return (
        <MoneyScreen title={t('repl.title')} subtitle={t('repl.subtitle')}>
          <Notice tone="warning" title={t('repl.notFlagged')} body={t('repl.notFlaggedBody')} />
          <UnavailableForm
            jobId={jobId}
            workerId={workerId}
            workerName={name ?? ''}
            side="RECRUITER"
            onCancel={() => router.back()}
            onDone={() => void options.refetch()}
          />
        </MoneyScreen>
      );
    }

    return (
      <MoneyScreen title={t('repl.title')} subtitle={t('repl.subtitle')}>
        <Notice
          tone={code === ApiErrorCode.ALREADY_PROCESSED ? 'info' : 'danger'}
          body={code === ApiErrorCode.ALREADY_PROCESSED ? t('repl.ended') : errorMessage(options.error)}
        />
        <View style={s.stack}>
          <OutlineButton label={t('repl.doneBack')} onPress={() => router.replace('/(app)/cover')} />
        </View>
      </MoneyScreen>
    );
  }

  // --- the matcher ---

  const chosen = data.eligible.find((person) => person.userId === selected) ?? null;
  const leftOut = data.excluded;

  const footer = confirming && chosen ? (
    <View style={s.confirm} testID="confirm-panel">
      <Text style={[s.confirmTitle, { color: c.text }]}>
        {t('repl.confirmTitle', { name: chosen.name })}
      </Text>
      <Text style={[s.confirmLine, { color: c.text }]}>• {t('repl.confirm1', { name: chosen.name })}</Text>
      <Text style={[s.confirmLine, { color: c.text }]}>
        • {t('repl.confirm2', { old: data.unavailable.name })}
      </Text>
      {data.shifts.length > 0 ? (
        <Text style={[s.confirmLine, { color: c.text }]}>
          • {t('repl.confirm3', { n: data.shifts.length, name: chosen.name })}
        </Text>
      ) : null}
      <Text style={[s.confirmLine, { color: c.textMuted }]}>• {t('repl.confirm4')}</Text>
      <View style={s.confirmActions}>
        <Pressable
          onPress={() => setConfirming(false)}
          accessibilityRole="button"
          style={[s.secondary, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Text style={[s.secondaryText, { color: c.text }]}>{t('repl.confirmNo')}</Text>
        </Pressable>
        <Pressable
          onPress={() => assign.mutate()}
          disabled={assign.isPending}
          accessibilityRole="button"
          testID="btn-confirm-assign"
          style={({ pressed }) => [
            s.secondary,
            s.grow,
            { borderColor: c.primary, backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
        >
          {assign.isPending ? (
            <ActivityIndicator color={c.primaryText} />
          ) : (
            <Text style={[s.secondaryText, { color: c.primaryText }]}>{t('repl.confirmYes')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  ) : data.eligible.length > 0 ? (
    <View>
      <Pressable
        onPress={() => chosen && setConfirming(true)}
        disabled={!chosen}
        accessibilityRole="button"
        testID="btn-assign"
        style={({ pressed }) => [
          s.primary,
          {
            backgroundColor: pressed ? c.primaryPressed : c.primary,
            opacity: chosen ? 1 : 0.5,
          },
        ]}
      >
        <Text style={[s.primaryText, { color: c.primaryText }]}>{t('repl.assign')}</Text>
      </Pressable>
      {!chosen ? <Text style={[s.hint, { color: c.textMuted }]}>{t('repl.pickFirst')}</Text> : null}
    </View>
  ) : undefined;

  return (
    <MoneyScreen
      title={t('repl.title')}
      subtitle={t('repl.subtitle')}
      refreshing={options.isRefetching}
      onRefresh={() => void options.refetch()}
      footer={footer}
    >
      {assign.error ? <Notice tone="danger" body={errorMessage(assign.error)} /> : null}

      <Card>
        <Text style={[s.jobTitle, { color: c.text }]} testID="job-title">
          {data.job.title}
        </Text>
        <Text style={[s.meta, { color: c.textMuted }]}>{data.job.location}</Text>
        <Text style={[s.replacing, { color: c.text }]} testID="replacing">
          {t('repl.replacing', { name: data.unavailable.name })} · {data.unavailable.publicId}
        </Text>
        <Text style={[s.flagged, { color: c.danger }]}>
          {t('repl.flagged', {
            reason: t(`repl.reason.${data.unavailable.reason}` as TranslationKey),
          })}
          {data.unavailable.note ? ` · “${data.unavailable.note}”` : ''}
        </Text>
        {data.shifts.length > 0 ? (
          <Text style={[s.meta, { color: c.textMuted }]}>
            {t('repl.shiftsPass', { n: data.shifts.length })} (
            {data.shifts.slice(0, 3).map((shift) => shortDate(shift.startsAt)).join(', ')}
            {data.shifts.length > 3 ? '…' : ''})
          </Text>
        ) : null}
      </Card>

      {data.eligible.length === 0 ? (
        <>
          <Notice tone="warning" title={t('repl.noneTitle')} body={t('repl.noneBody')} />
          <View style={s.stack}>
            <OutlineButton
              label={t('repl.openApplicants')}
              onPress={() =>
                router.push({ pathname: '/(app)/applicants/[jobId]', params: { jobId } })
              }
            />
          </View>
        </>
      ) : (
        <>
          <Text style={[s.heading, { color: c.text }]} testID="eligible-heading">
            {t('repl.eligible', { n: data.eligible.length })}
          </Text>
          <Text style={[s.meta, { color: c.textMuted }]}>{t('repl.eligibleHint')}</Text>
          {data.eligible.map((person) => (
            <CandidateCard
              key={person.userId}
              person={person}
              selected={selected === person.userId}
              onSelect={() => {
                setSelected(person.userId);
                setConfirming(false);
              }}
              date={shortDate(person.appliedAt)}
            />
          ))}
        </>
      )}

      {leftOut.length > 0 ? (
        <>
          <Pressable
            onPress={() => setShowLeftOut((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showLeftOut }}
            testID="toggle-left-out"
            style={s.leftOutHead}
          >
            <Text style={[s.heading, s.noMargin, { color: c.text }]}>
              {t('repl.notOffered', { n: leftOut.length })}
            </Text>
            <Text style={[s.meta, { color: c.textMuted }]}>{showLeftOut ? '▴' : '▾'}</Text>
          </Pressable>
          {showLeftOut
            ? leftOut.map((person) => (
                <View
                  key={person.userId}
                  style={[s.leftOut, { borderColor: c.border, backgroundColor: c.surface }]}
                  testID={`left-out-${person.reason}`}
                >
                  <Text style={[s.leftName, { color: c.text }]}>{person.name}</Text>
                  {whyNot(person).map((line) => (
                    <Text key={line} style={[s.meta, { color: c.textMuted }]}>
                      {line}
                    </Text>
                  ))}
                </View>
              ))
            : null}
        </>
      ) : null}
    </MoneyScreen>
  );

  function whyNot(person: ExcludedCandidate): string[] {
    switch (person.reason) {
      case 'BUSY':
        return [t('repl.why.BUSY', { date: person.clashAt ? shortDate(person.clashAt) : '—' })];
      case 'REQUIREMENTS': {
        const lines: string[] = [];
        if (person.needsYears !== null) {
          lines.push(
            t('repl.why.YEARS', { needs: person.needsYears, has: person.hasYears ?? '—' }),
          );
        }
        if (person.noSkillMatch) lines.push(t('repl.why.SKILLS'));
        return lines;
      }
      case 'BLOCKED':
        return [t('repl.why.BLOCKED')];
      default:
        return [t('repl.why.INACTIVE')];
    }
  }
}

function CandidateCard({
  person,
  selected,
  onSelect,
  date,
}: {
  person: HireCandidate;
  selected: boolean;
  onSelect: () => void;
  date: string;
}) {
  const t = useT();
  const { c } = useTheme();

  const [fitBg, fitFg] =
    person.fit >= 70
      ? [c.successSoft, c.success]
      : person.fit >= 45
        ? [c.primarySoft, c.primary]
        : [c.warningSoft, c.warning];

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      testID={`cand-${person.publicId}`}
      style={[
        s.card,
        {
          borderColor: selected ? c.primary : c.border,
          borderWidth: selected ? 2 : 1,
          backgroundColor: selected ? c.primarySoft : c.surface,
        },
      ]}
    >
      <View style={s.cardTop}>
        <View style={[s.radio, { borderColor: selected ? c.primary : c.border }]}>
          {selected ? <View style={[s.radioDot, { backgroundColor: c.primary }]} /> : null}
        </View>
        <View style={s.grow}>
          <Text style={[s.candName, { color: c.text }]} numberOfLines={1}>
            {person.name}
            {person.verified ? '  ✓' : ''}
          </Text>
          <Text style={[s.meta, { color: c.textMuted }]}>{person.publicId}</Text>
        </View>
        <View style={[s.fit, { backgroundColor: fitBg }]}>
          <Text style={[s.fitText, { color: fitFg }]}>{t('repl.fit', { n: person.fit })}</Text>
        </View>
      </View>

      {person.titles.length > 0 || person.yearsExperience !== null ? (
        <Text style={[s.detail, { color: c.text }]}>
          {[
            person.titles.slice(0, 2).join(', '),
            person.yearsExperience !== null
              ? t('repl.yearsExp', { n: person.yearsExperience })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
      {person.matchedSkills.length > 0 ? (
        <Text style={[s.detail, { color: c.textMuted }]}>
          {t('repl.matches', { skills: person.matchedSkills.slice(0, 4).join(', ') })}
        </Text>
      ) : null}
      {person.flags.map((flag) => (
        <Text key={flag} style={[s.detail, { color: c.warning }]}>
          {t(`repl.flag.${flag}` as TranslationKey)}
        </Text>
      ))}
      <View style={s.cardBottom}>
        <Text style={[s.meta, { color: c.textMuted }]}>{t('repl.applied', { date })}</Text>
        {selected ? (
          <Text style={[s.selectedText, { color: c.primary }]}>{t('repl.selected')}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  grow: { flex: 1 },
  stack: { gap: space.sm, marginTop: space.md },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: 2 },
  noMargin: { marginTop: 0, marginBottom: 0 },
  meta: { fontSize: font.xs, lineHeight: 17, marginTop: 2 },
  hint: { fontSize: font.xs, textAlign: 'center', marginTop: 6 },

  jobTitle: { fontSize: font.lg, fontWeight: '800' },
  replacing: { fontSize: font.sm, fontWeight: '800', marginTop: 10 },
  flagged: { fontSize: font.xs + 1, fontWeight: '700', marginTop: 2 },

  card: { borderRadius: radius.lg, padding: space.md, marginTop: space.sm, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  candName: { fontSize: font.md, fontWeight: '800' },
  fit: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  fitText: { fontSize: font.xs, fontWeight: '800' },
  detail: { fontSize: font.sm, lineHeight: 19 },
  selectedText: { fontSize: font.xs, fontWeight: '800' },

  leftOutHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  leftOut: { borderWidth: 1, borderRadius: radius.md, padding: space.sm + 2, marginTop: space.sm },
  leftName: { fontSize: font.sm, fontWeight: '800' },

  primary: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: { fontSize: font.md, fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryText: { fontSize: font.sm + 1, fontWeight: '800' },

  confirm: { gap: 4 },
  confirmTitle: { fontSize: font.md, fontWeight: '800', marginBottom: 2 },
  confirmLine: { fontSize: font.sm, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },

  doneCard: { alignItems: 'center', gap: 6 },
  tick: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tickText: { fontSize: 28, fontWeight: '800' },
  doneTitle: { fontSize: font.lg, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  doneBody: { fontSize: font.sm, lineHeight: 20, textAlign: 'center' },
  status: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6 },
  statusText: { fontSize: font.xs + 1, fontWeight: '800' },
});
