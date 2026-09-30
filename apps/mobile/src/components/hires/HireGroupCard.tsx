import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatTaka,
  jobCategoryName,
  type HireGroup,
  type HireJob,
  type HirePerson,
  type JobStaffing,
  type ReviewRole,
} from '@workflex/shared';
import { completeHire } from '../../api/hires';
import { markAvailable } from '../../api/replacement';
import { createReview } from '../../api/reviews';
import { useAuthStore } from '../../store/auth-store';
import { UnavailableForm } from './UnavailableForm';
import { useErrorMessage } from '../../lib/error-message';
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * One job and the people on it, for both hired lists.
 *
 * `as` is the reader's side. A recruiter sees the people they hired; tapping
 * a name opens their details, pay, rating and review, and the question that
 * finishes the hire. A worker sees the recruiter who hired them, and can
 * rate and review them — finishing a job is the recruiter's call.
 */
export function HireGroupCard({
  group,
  as,
  onPay,
}: {
  group: HireGroup;
  as: ReviewRole;
  onPay?: (person: HirePerson) => void;
}) {
  const t = useT();
  const [locale] = useLocale();
  const { c } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const { job } = group;

  const facts = [
    job.location,
    `${t(`jobs.type.${job.jobType}` as TranslationKey)} · ${t(`jobs.place.${job.workplaceType}` as TranslationKey)}`,
    formatPay(job, t(`jobs.pay.${job.paymentType}` as TranslationKey)),
    job.startDate ? t('hires.starts', { date: shortDate(job.startDate, locale) }) : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.title, { color: c.text }]}>{job.title}</Text>
      <Text style={[s.company, { color: c.textMuted }]} numberOfLines={1}>
        {job.companyName} · {jobCategoryName(job.category, locale)}
      </Text>

      <View style={[s.idBox, { backgroundColor: c.surfaceAlt }]}>
        <Text style={[s.idLabel, { color: c.textMuted }]}>{t('hires.jobId')}</Text>
        <Text selectable style={[s.idValue, { color: c.text }]}>
          {job.id}
        </Text>
      </View>

      <View style={s.facts}>
        {facts.map((fact) => (
          <View key={fact} style={[s.fact, { backgroundColor: c.primarySoft }]}>
            <Text style={[s.factText, { color: c.primary }]}>{fact}</Text>
          </View>
        ))}
      </View>

      {as === 'RECRUITER' && group.staffing !== 'RECRUITING' ? (
        <StaffingChip staffing={group.staffing} />
      ) : null}

      <Text style={[s.section, { color: c.text }]}>
        {as === 'RECRUITER'
          ? t('hires.hiredPeople', { count: group.people.length })
          : t('hires.recruiter')}
      </Text>
      <Text style={[s.tapHint, { color: c.textMuted }]}>
        {as === 'RECRUITER' ? t('hires.tapName') : t('hires.tapNameWorker')}
      </Text>

      {group.people.map((person) => (
        <PersonRow
          key={person.userId}
          person={person}
          job={job}
          as={as}
          open={openId === person.userId}
          onToggle={() => setOpenId(openId === person.userId ? null : person.userId)}
          onPay={onPay}
        />
      ))}
    </View>
  );
}

function PersonRow({
  person,
  job,
  as,
  open,
  onToggle,
  onPay,
}: {
  person: HirePerson;
  job: HireJob;
  as: ReviewRole;
  open: boolean;
  onToggle: () => void;
  onPay?: (person: HirePerson) => void;
}) {
  const t = useT();
  const [locale] = useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const me = useAuthStore((state) => state.user?.id);
  const [asking, setAsking] = useState(false);

  // Unavailable and not yet replaced; and replaced, which ends the hire.
  const flagged = person.unavailable !== null && person.completedAt === null;
  const replaced = person.replacedAt !== null;
  // Whose hire this is: the listed person for an employer, the reader for a worker.
  const workerId = as === 'RECRUITER' ? person.userId : me;
  const reasonText = person.unavailable
    ? t(`repl.reason.${person.unavailable.reason}` as TranslationKey)
    : '';

  const undo = useMutation({
    mutationFn: () => markAvailable(job.id, workerId!),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hires'] });
      void client.invalidateQueries({ queryKey: ['my-jobs'] });
      void client.invalidateQueries({ queryKey: ['replacement'] });
    },
  });

  const openMatcher = () =>
    router.push({
      pathname: '/(app)/cover/job/[jobId]',
      params: { jobId: job.id, workerId: person.userId, name: person.name },
    });

  return (
    <View style={[s.person, { borderTopColor: c.border }]} testID={`hire-${person.publicId}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={s.personTop}
      >
        <View style={[s.avatar, { backgroundColor: c.primarySoft }]}>
          <Text style={[s.avatarText, { color: c.primary }]}>{initials(person.name)}</Text>
        </View>
        <View style={s.flex}>
          <Text style={[s.name, { color: c.primary }]} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
            {replaced
              ? `${t('repl.replacedBadge')} · ${shortDate(person.replacedAt!, locale)}`
              : person.completedAt
                ? t('hires.completedOn', { date: shortDate(person.completedAt, locale) })
                : t('hires.hiredOn', { date: shortDate(person.hiredAt, locale) })}
            {person.replaces ? `  ·  ${t('repl.replaced', { name: person.replaces.name })}` : ''}
            {person.myReview ? `  ·  ${'★'.repeat(person.myReview.rating)}` : ''}
          </Text>
        </View>
        {replaced ? (
          <View style={[s.badge, { backgroundColor: c.surfaceAlt }]}>
            <Text style={[s.badgeText, { color: c.textMuted }]}>{t('repl.replacedBadge')}</Text>
          </View>
        ) : person.completedAt ? (
          <View style={[s.badge, { backgroundColor: c.successSoft }]}>
            <Text style={[s.badgeText, { color: c.success }]}>{t('hires.completedBadge')}</Text>
          </View>
        ) : flagged ? (
          <View style={[s.badge, { backgroundColor: c.dangerSoft }]} testID="badge-unavailable">
            <Text style={[s.badgeText, { color: c.danger }]}>{t('repl.unavailableBadge')}</Text>
          </View>
        ) : null}
        <Text style={[s.chevron, { color: c.textMuted }]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={[s.panel, { backgroundColor: c.surfaceAlt }]}>
          <Detail label={t('hires.workflexId')} value={person.publicId} />
          <Detail label={t('hires.phone')} value={person.phone} />
          <Detail
            label={as === 'RECRUITER' ? t('hires.paid') : t('hires.received')}
            value={formatTaka(person.paid)}
          />

          {as === 'RECRUITER' && onPay ? (
            <View style={s.actions}>
              <SmallButton primary label={`৳ ${t('hired.pay')}`} onPress={() => onPay(person)} />
            </View>
          ) : null}

          {/* The employer's side of a worker who cannot continue: say so, or
              — once said — go and choose somebody. */}
          {as === 'RECRUITER' && flagged ? (
            <View
              style={[s.flag, { borderColor: c.dangerBorder, backgroundColor: c.dangerSoft }]}
              testID="flag-box"
            >
              <Text style={[s.flagTitle, { color: c.danger }]}>
                {t('repl.flagged', { reason: reasonText })}
              </Text>
              <Text style={[s.flagMeta, { color: c.text }]}>
                {t(`repl.flaggedBy${person.unavailable!.by}` as TranslationKey)}
                {person.unavailable!.note ? ` · “${person.unavailable!.note}”` : ''}
              </Text>
              <View style={s.actions}>
                <SmallButton
                  primary
                  label={t('cover.findReplacement')}
                  onPress={openMatcher}
                  testID="btn-open-matcher"
                />
                <SmallButton
                  label={t('repl.availableAgain')}
                  onPress={() => undo.mutate()}
                  busy={undo.isPending}
                />
              </View>
            </View>
          ) : null}
          {as === 'RECRUITER' && !flagged && !person.completedAt ? (
            asking ? (
              <UnavailableForm
                jobId={job.id}
                workerId={person.userId}
                workerName={person.name}
                side="RECRUITER"
                onCancel={() => setAsking(false)}
                onDone={() => {
                  setAsking(false);
                  openMatcher();
                }}
              />
            ) : (
              <SmallButton
                label={t('repl.markUnavailable')}
                onPress={() => setAsking(true)}
                testID="btn-mark-unavailable"
              />
            )
          ) : null}

          {/* The worker's side: "I can't continue", and taking it back. */}
          {as === 'WORKER' && flagged && workerId ? (
            <View
              style={[s.flag, { borderColor: c.dangerBorder, backgroundColor: c.dangerSoft }]}
              testID="flag-box"
            >
              <Text style={[s.flagTitle, { color: c.danger }]}>
                {t('repl.flaggedSelf', { reason: reasonText })}
              </Text>
              <View style={s.actions}>
                <SmallButton
                  label={t('repl.availableAgainSelf')}
                  onPress={() => undo.mutate()}
                  busy={undo.isPending}
                  testID="btn-available-again"
                />
              </View>
            </View>
          ) : null}
          {as === 'WORKER' && !flagged && !person.completedAt && workerId ? (
            asking ? (
              <UnavailableForm
                jobId={job.id}
                workerId={workerId}
                workerName={person.name}
                side="WORKER"
                onCancel={() => setAsking(false)}
                onDone={() => setAsking(false)}
              />
            ) : (
              <SmallButton
                label={t('repl.markSelf')}
                onPress={() => setAsking(true)}
                testID="btn-mark-self"
              />
            )
          ) : null}

          {/* The options, together in one box: rating, review, and — for the
              recruiter — "Is the job fully completed?". */}
          <View style={[s.block, { borderColor: c.border, backgroundColor: c.surface }]}>
            <RateAndReview person={person} jobId={job.id} as={as} />
            {as === 'RECRUITER' ? (
              <FinishJob person={person} jobId={job.id} />
            ) : (
              <Text style={[s.workerNote, { color: person.completedAt && !replaced ? c.success : c.textMuted }]}>
                {replaced
                  ? t('repl.replacedNote')
                  : person.completedAt
                    ? t('hires.completedByRecruiter', { date: shortDate(person.completedAt, locale) })
                    : t('hires.onlyRecruiter')}
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The two options: a rating, one to five stars, and a written review. One
 * submit sends both — a review is stored with its rating, so the stars are
 * the part that is required and the words are optional.
 */
function RateAndReview({
  person,
  jobId,
  as,
}: {
  person: HirePerson;
  jobId: string;
  as: ReviewRole;
}) {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const client = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      createReview({
        jobId,
        subjectId: person.userId,
        // The reader hired this person, so they are reviewed as a worker —
        // or the reader was hired by them, so as a recruiter.
        subjectRole: as === 'RECRUITER' ? 'WORKER' : 'RECRUITER',
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hires'] });
      void client.invalidateQueries({ queryKey: ['ratings'] });
    },
  });

  if (person.myReview) {
    return (
      <View>
        <Text style={[s.blockLabel, { color: c.textMuted }]}>{t('hires.yourRating')}</Text>
        <Text style={[s.starsDone, { color: c.accent }]}>
          {'★'.repeat(person.myReview.rating)}
          <Text style={{ color: c.border }}>{'★'.repeat(5 - person.myReview.rating)}</Text>
        </Text>
        <Text style={[s.blockLabel, s.gap, { color: c.textMuted }]}>{t('hires.yourReview')}</Text>
        <Text style={[s.reviewText, { color: c.text }]}>
          {person.myReview.comment ? `“${person.myReview.comment}”` : t('hires.noWords')}
        </Text>
      </View>
    );
  }

  const first = person.name.split(' ')[0] ?? person.name;

  return (
    <View>
      <Text style={[s.blockLabel, { color: c.textMuted }]}>{t('hires.rating')}</Text>
      <View style={s.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setRating(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('hires.stars', { n })}
            accessibilityState={{ selected: n <= rating }}
          >
            <Text style={[s.star, { color: n <= rating ? c.accent : c.border }]}>★</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.blockLabel, s.gap, { color: c.textMuted }]}>{t('hires.review')}</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={t('hires.reviewPlaceholder', { name: first })}
        placeholderTextColor={c.textMuted}
        multiline
        maxLength={600}
        style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.fieldBg }]}
      />

      {submit.error ? (
        <Text style={[s.error, { color: c.danger }]}>{errorMessage(submit.error)}</Text>
      ) : null}

      <Pressable
        onPress={() => submit.mutate()}
        disabled={rating === 0 || submit.isPending}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.submit,
          {
            backgroundColor:
              rating === 0 ? c.border : pressed ? c.primaryPressed : c.primary,
          },
        ]}
      >
        {submit.isPending ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[s.submitText, { color: c.primaryText }]}>{t('hires.submit')}</Text>
        )}
      </Pressable>
      {rating === 0 ? (
        <Text style={[s.hint, { color: c.textMuted }]}>{t('hires.pickStars')}</Text>
      ) : null}
    </View>
  );
}

/**
 * "Is the job fully completed?" — asked, then confirmed in place, since a
 * finished hire leaves the list. The confirmation is inline rather than a
 * system alert, which the web build does not show.
 */
function FinishJob({ person, jobId }: { person: HirePerson; jobId: string }) {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const client = useQueryClient();
  const [asking, setAsking] = useState(false);

  const finish = useMutation({
    mutationFn: () => completeHire(jobId, person.userId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hires'] });
      void client.invalidateQueries({ queryKey: ['payees'] });
    },
  });

  if (!asking) {
    return (
      <Pressable
        onPress={() => setAsking(true)}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.finish,
          { borderColor: c.success, backgroundColor: c.successSoft, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[s.finishText, { color: c.success }]}>{t('hires.complete')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[s.confirm, { borderColor: c.warningBorder, backgroundColor: c.warningSoft }]}>
      <Text style={[s.confirmTitle, { color: c.text }]}>
        {t('hires.confirmTitle', { name: person.name })}
      </Text>
      <Text style={[s.confirmBody, { color: c.text }]}>
        {t('hires.confirmBody', { name: person.name })}
      </Text>
      {!person.myReview ? (
        <Text style={[s.confirmBody, { color: c.warning }]}>
          {t('hires.notRatedYet', { name: person.name })}
        </Text>
      ) : null}
      {finish.error ? (
        <Text style={[s.error, { color: c.danger }]}>{errorMessage(finish.error)}</Text>
      ) : null}
      <View style={s.actions}>
        <SmallButton label={t('hires.confirmNo')} onPress={() => setAsking(false)} />
        <SmallButton
          primary
          label={t('hires.confirmYes')}
          busy={finish.isPending}
          onPress={() => finish.mutate()}
        />
      </View>
    </View>
  );
}

/** How full the job is: a colour and a word, since the words alone are easy to skim past. */
function StaffingChip({ staffing }: { staffing: JobStaffing }) {
  const t = useT();
  const { c } = useTheme();
  const [bg, fg] =
    staffing === 'NEEDS_REPLACEMENT'
      ? [c.dangerSoft, c.danger]
      : staffing === 'FILLED'
        ? [c.successSoft, c.success]
        : [c.warningSoft, c.warning];
  return (
    <View style={[s.staffing, { backgroundColor: bg }]} testID="job-staffing">
      <Text style={[s.staffingText, { color: fg }]}>
        {t(`staffing.${staffing}` as TranslationKey)}
      </Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.detail}>
      <Text style={[s.detailLabel, { color: c.textMuted }]}>{label}</Text>
      <Text selectable style={[s.detailValue, { color: c.text }]}>
        {value}
      </Text>
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  primary,
  busy,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.small,
        primary
          ? { backgroundColor: pressed ? c.primaryPressed : c.primary, borderColor: c.primary }
          : { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.primaryText : c.primary} />
      ) : (
        <Text style={[s.smallText, { color: primary ? c.primaryText : c.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Same wording as the job cards: the cadence always travels with the figure. */
function formatPay(job: HireJob, cadence: string): string {
  const money = (n: number) => `৳${n.toLocaleString('en-US')}`;
  if (job.salaryMin !== null && job.salaryMax !== null) {
    return `${money(job.salaryMin)} – ${money(job.salaryMax)} · ${cadence}`;
  }
  if (job.salaryMin !== null) return `${money(job.salaryMin)}+ · ${cadence}`;
  if (job.salaryMax !== null) return `≤ ${money(job.salaryMax)} · ${cadence}`;
  return cadence;
}

function shortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return letters.toUpperCase();
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
  },
  title: { fontSize: font.lg, fontWeight: '800' },
  company: { fontSize: font.sm, marginTop: 2 },

  idBox: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  idLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  idValue: { fontSize: font.xs + 1, fontFamily: 'monospace', marginTop: 2 },

  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  fact: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  factText: { fontSize: font.xs, fontWeight: '700' },

  staffing: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  staffingText: { fontSize: font.xs, fontWeight: '800' },
  flag: { borderWidth: 1, borderRadius: radius.md, padding: space.sm + 2, gap: 4 },
  flagTitle: { fontSize: font.sm, fontWeight: '800' },
  flagMeta: { fontSize: font.xs, lineHeight: 17 },

  section: { fontSize: font.md, fontWeight: '800', marginTop: space.md },
  tapHint: { fontSize: font.xs, marginTop: 2, marginBottom: 4 },

  person: { borderTopWidth: 1, paddingVertical: 10 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.sm, fontWeight: '800' },
  name: { fontSize: font.md, fontWeight: '800', textDecorationLine: 'underline' },
  meta: { fontSize: font.xs, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  chevron: { fontSize: font.md, width: 16, textAlign: 'center' },

  panel: { borderRadius: radius.md, padding: space.sm + 2, marginTop: 10, gap: 8 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  detailLabel: { fontSize: font.sm },
  detailValue: { fontSize: font.sm, fontWeight: '700', flexShrink: 1, textAlign: 'right' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  small: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  smallText: { fontSize: font.sm, fontWeight: '800' },

  block: { borderWidth: 1, borderRadius: radius.md, padding: space.sm + 2, marginTop: 4 },
  blockLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  gap: { marginTop: 10 },
  starRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  star: { fontSize: 30 },
  starsDone: { fontSize: 22, letterSpacing: 2, marginTop: 2 },
  reviewText: { fontSize: font.sm, lineHeight: 20, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: font.sm,
    marginTop: 4,
  },
  error: { fontSize: font.sm, marginTop: 6 },
  submit: {
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  submitText: { fontSize: font.sm, fontWeight: '800' },
  hint: { fontSize: font.xs, marginTop: 6, textAlign: 'center' },

  finish: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  finishText: { fontSize: font.sm, fontWeight: '800' },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: space.sm + 2, marginTop: 12, gap: 6 },
  workerNote: { fontSize: font.xs + 1, lineHeight: 18, marginTop: 12, fontWeight: '700' },
  confirmTitle: { fontSize: font.md, fontWeight: '800' },
  confirmBody: { fontSize: font.sm, lineHeight: 20 },
});
