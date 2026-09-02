import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jobCategoryName,
  type PaymentType,
  type RecommendationReason,
  type RecommendedJob,
} from '@workflex/shared';
import { fetchRecommendations, toggleSavedJob } from '../../api/jobs';
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * How many suggestions the dashboard shows.
 *
 * The row used to carry eight cards side by side, each narrow enough to hold a
 * title and little else. A dashboard is a summary: three full-width cards that
 * can be read without opening anything beat eight that have to be tapped to
 * mean anything, and "See all" is there for the rest.
 */
const SHOWN = 3;

const REASON_LABELS: Record<RecommendationReason, TranslationKey> = {
  SKILLS: 'rec.reason.SKILLS',
  LOCATION: 'rec.reason.LOCATION',
  AVAILABILITY: 'rec.reason.AVAILABILITY',
  PREFERENCE: 'rec.reason.PREFERENCE',
};

const REASON_ICONS: Record<RecommendationReason, string> = {
  SKILLS: '🧠',
  LOCATION: '📍',
  AVAILABILITY: '⏰',
  PREFERENCE: '⭐',
};

const PAYMENT_KEYS: Record<PaymentType, TranslationKey> = {
  HOURLY: 'jobs.pay.HOURLY',
  DAILY: 'jobs.pay.DAILY',
  WEEKLY: 'jobs.pay.WEEKLY',
  MONTHLY: 'jobs.pay.MONTHLY',
  FIXED_PROJECT: 'jobs.pay.FIXED_PROJECT',
  NEGOTIABLE: 'jobs.pay.NEGOTIABLE',
};

/** ৳35K rather than ৳35,000 — the card has one line for pay, not two. */
function short(amount: number): string {
  return amount >= 1000
    ? `৳${Math.round(amount / 1000)}K`
    : `৳${amount}`;
}

/**
 * Suggestions built from what this account has actually done.
 *
 * The section removes itself when there is nothing to personalise on. A new
 * account with no CV and no history has told the system nothing, and filling
 * the row with arbitrary postings under a personalised heading is worse than
 * showing no row at all — it teaches people the section means nothing.
 */
export function RecommendedForYou() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const [explaining, setExplaining] = useState<RecommendedJob | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: fetchRecommendations,
    // Suggestions change when the person saves or applies to something, which
    // already invalidates this key; a short stale time stops the dashboard
    // refetching on every glance.
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <View style={styles.section}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!data || data.items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>
          ✨ {t('rec.title')}
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/jobs')}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.seeAll, { color: c.primary }]}>
            {t('rec.seeAll')} →
          </Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {data.items.slice(0, SHOWN).map((item) => (
          <RecommendationCard
            key={item.job.id}
            item={item}
            onExplain={() => setExplaining(item)}
            onView={() =>
              router.push({
                pathname: '/(app)/job/[id]',
                params: { id: item.job.id },
              })
            }
          />
        ))}
      </View>

      <MatchBreakdown
        item={explaining}
        onClose={() => setExplaining(null)}
      />
    </View>
  );
}

function RecommendationCard({
  item,
  onExplain,
  onView,
}: {
  item: RecommendedJob;
  onExplain: () => void;
  onView: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const { job } = item;

  const save = useMutation({
    mutationFn: () => toggleSavedJob(job.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const pay =
    job.salaryMin && job.salaryMax
      ? `${short(job.salaryMin)}–${short(job.salaryMax)}`
      : job.salaryMin
        ? `${short(job.salaryMin)}+`
        : job.salaryMax
          ? `${t('post.review.upTo')} ${short(job.salaryMax)}`
          : t('jobs.pay.NEGOTIABLE');

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={[styles.jobTitle, { color: c.text }]} numberOfLines={2}>
            {job.title}
          </Text>
          <Text style={[styles.company, { color: c.textMuted }]} numberOfLines={1}>
            {job.companyName}
          </Text>
        </View>

        <View
          style={[
            styles.logo,
            { backgroundColor: c.tints[1], borderColor: c.tintBorders[1] },
          ]}
        >
          <Text style={[styles.logoText, { color: c.text }]}>
            {job.companyInitials}
          </Text>
        </View>
      </View>

      {/* The score is a control, not a label — tapping it opens the working.
          A percentage nobody can interrogate is a number to be taken on
          faith, which is the opposite of what showing it is for. */}
      <Pressable
        onPress={onExplain}
        accessibilityRole="button"
        accessibilityLabel={t('rec.explainA11y', { percent: item.fit })}
        hitSlop={6}
        style={[
          styles.match,
          { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder },
        ]}
      >
        <Text style={[styles.matchText, { color: c.primary }]}>
          🤖 {t('rec.aiMatch', { percent: item.fit })}
        </Text>
        <Text style={[styles.matchHint, { color: c.primary }]}>ⓘ</Text>
      </Pressable>

      <View style={styles.facts}>
        <Fact icon="📍" text={job.location} />
        <Fact icon="💰" text={`${pay} · ${t(PAYMENT_KEYS[job.paymentType])}`} />
        <Fact
          icon="💼"
          text={`${t(`jobs.type.${job.jobType}` as TranslationKey)} · ${jobCategoryName(
            job.category,
            locale,
          )}`}
        />
      </View>

      <View style={[styles.actions, { borderTopColor: c.border }]}>
        <Pressable
          onPress={() => save.mutate()}
          disabled={save.isPending}
          accessibilityRole="button"
          accessibilityState={{ selected: job.saved }}
          style={styles.saveBtn}
        >
          <Text
            style={[
              styles.saveText,
              { color: job.saved ? c.primary : c.textMuted },
            ]}
          >
            {job.saved ? '♥' : '♡'}{' '}
            {t(job.saved ? 'jobs.unsave' : 'jobs.save')}
          </Text>
        </Pressable>

        <Pressable
          onPress={onView}
          accessibilityRole="button"
          style={[styles.viewBtn, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.viewText, { color: c.primaryText }]}>
            {t('rec.viewJob')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Fact({ icon, text }: { icon: string; text: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={styles.factIcon}>{icon}</Text>
      <Text style={[styles.factText, { color: c.textMuted }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The arithmetic behind one score.
 *
 * Every signal that was available is listed, including the ones that scored
 * nothing — a breakdown that quietly drops its failures flatters the total it
 * claims to explain, and the first zero a reader spots elsewhere would discredit
 * the whole thing.
 *
 * The skills row counts against the CV's own skills, because "5 of 31" is a
 * fact the reader can check where "83%" is only an assertion.
 */
function MatchBreakdown({
  item,
  onClose,
}: {
  item: RecommendedJob | null;
  onClose: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Its own Pressable, so a tap inside the sheet does not reach the
            backdrop and close what the reader just opened. */}
        <Pressable
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => undefined}
        >
          <Text style={[styles.sheetTitle, { color: c.text }]}>
            🤖 {t('rec.aiMatch', { percent: item.fit })}
          </Text>
          <Text style={[styles.sheetJob, { color: c.textMuted }]} numberOfLines={2}>
            {item.job.title}
          </Text>

          <View style={styles.rows}>
            {item.factors.map((f) => (
              <View key={f.signal} style={styles.factorRow}>
                <Text style={[styles.factorLabel, { color: c.text }]}>
                  {REASON_ICONS[f.signal]} {t(REASON_LABELS[f.signal])}
                </Text>

                <View style={styles.factorRight}>
                  {f.matched !== null && f.outOf !== null ? (
                    <Text style={[styles.factorDetail, { color: c.textMuted }]}>
                      {t('rec.matchedOf', { matched: f.matched, outOf: f.outOf })}
                    </Text>
                  ) : null}
                  <Text style={[styles.factorPercent, { color: c.text }]}>
                    {f.percent}%
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.sheetNote, { color: c.textMuted }]}>
            {t('rec.explainNote')}
          </Text>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.close, { borderColor: c.border }]}
          >
            <Text style={[styles.closeText, { color: c.text }]}>
              {t('common.close')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },
  seeAll: { fontSize: font.sm, fontWeight: '800' },

  // Stacked full width, not a horizontal rail: a card you have to scroll
  // sideways to reach is a card most people never see.
  list: { marginTop: space.md, gap: 12 },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardHeadText: { flex: 1 },
  jobTitle: { fontSize: font.md, fontWeight: '800', letterSpacing: -0.2 },
  company: { fontSize: font.sm, marginTop: 2, fontWeight: '600' },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: font.sm, fontWeight: '800' },

  match: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  matchText: { fontSize: font.sm, fontWeight: '800' },
  matchHint: { fontSize: font.xs, fontWeight: '800', opacity: 0.7 },

  facts: { marginTop: 10, gap: 5 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  factIcon: { fontSize: 13 },
  factText: { flex: 1, fontSize: font.sm },

  /**
   * Wraps rather than clipping.
   *
   * "Save this job" and "View job" fit side by side in English, but Bangla
   * spends far more characters on both — on a 320px phone the pair asked for
   * 299px of a 243px row and the button was simply cut off at the screen
   * edge, still tappable in theory and invisible in practice. Wrapping lets
   * it drop onto its own line instead, and `flexShrink` on the save link
   * keeps that from happening a moment sooner than it must.
   */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  saveBtn: { flexShrink: 1, paddingVertical: 6, paddingRight: 8 },
  saveText: { fontSize: font.sm, fontWeight: '800' },
  viewBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  viewText: { fontSize: font.sm, fontWeight: '800' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: space.md,
  },
  sheet: { borderWidth: 1, borderRadius: radius.xl, padding: 18 },
  sheetTitle: { fontSize: font.lg, fontWeight: '800' },
  sheetJob: { fontSize: font.sm, marginTop: 2 },
  rows: { marginTop: space.md, gap: 12 },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  factorLabel: { flex: 1, fontSize: font.sm, fontWeight: '700' },
  factorRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factorDetail: { fontSize: font.xs },
  factorPercent: {
    fontSize: font.sm,
    fontWeight: '800',
    // Fixed width so the column of percentages lines up.
    minWidth: 42,
    textAlign: 'right',
  },
  sheetNote: { fontSize: font.xs, lineHeight: 17, marginTop: space.md },
  close: {
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: space.md,
  },
  closeText: { fontSize: font.sm, fontWeight: '800' },
});
