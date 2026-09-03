import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  jobCategoryName,
  type SkillGap,
  type SkillPath,
} from '@workflex/shared';
import { fetchSkillPath } from '../../api/cv';
import { useLocale, useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * What to learn next, from what employers on this platform are asking for.
 *
 * Every figure here is counted from open postings and the account's own parsed
 * CV — no model call and no external data set, which is what lets the card say
 * "34 postings ask for this" rather than "we recommend this". The distinction
 * matters: the first is evidence a reader can check, the second is advice they
 * have to take on trust.
 *
 * The card removes itself when the evidence is not there — no CV to compare,
 * or no postings in the person's field naming any skill at all. Inventing a
 * target role for someone the system knows nothing about would be the most
 * visible dishonest thing on the dashboard.
 */
export function NextSkillAI() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const [locale] = useLocale();

  // Which gap the reader has asked about. Null is the closed state; the whole
  // gap goes in rather than its name, so the sheet never has to look it up
  // again and cannot show figures from a stale copy.
  const [asking, setAsking] = useState<SkillGap | null>(null);

  const { data } = useQuery({
    queryKey: ['skill-path'],
    queryFn: fetchSkillPath,
    // Demand moves as postings are added, not minute to minute.
    staleTime: 300_000,
  });

  const path = data?.path;
  if (!path || path.gaps.length === 0) return null;

  const top = path.gaps[0]!;

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.text }]}>
            🤖 {t('skill.title')}
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/jobs')}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={[styles.explore, { color: c.primary }]}>
              {t('skill.explore')} →
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.headline, { color: c.text }]}>
          {t('skill.readiness', {
            percent: path.readiness,
            role: path.targetRole,
          })}
        </Text>

        {/* The bar is the claim; the sentence under it is the evidence. */}
        <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
          <View
            style={[
              styles.fill,
              { width: `${path.readiness}%`, backgroundColor: c.primary },
            ]}
          />
        </View>

        <Text style={[styles.basis, { color: c.textMuted }]}>
          {t('skill.basis', {
            count: path.jobsConsidered,
            field: jobCategoryName(path.category, locale),
          })}
        </Text>

        <View style={styles.gaps}>
          {path.gaps.map((gap) => (
            <GapRow key={gap.skill} gap={gap} onAsk={() => setAsking(gap)} />
          ))}
        </View>

        {top.unlocks > 0 ? (
          <Text style={[styles.unlock, { color: c.text }]}>
            {t('skill.unlock', { skill: top.skill, count: top.unlocks })}
          </Text>
        ) : null}

        <Pressable
          onPress={() =>
            router.push({ pathname: '/(app)/jobs', params: { q: top.skill } })
          }
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.ctaText, { color: c.primaryText }]}>
            {t('skill.viewPath')} →
          </Text>
        </Pressable>
      </View>

      <WhyThisSkill
        gap={asking}
        path={path}
        onClose={() => setAsking(null)}
      />
    </View>
  );
}

/**
 * One suggested skill, and the way into why it was suggested.
 *
 * A row rather than a bare line because the percentage beside it is the part
 * people disbelieve — "why that one?" is the first reaction to any
 * recommendation, and the answer should be one tap away rather than absent.
 */
function GapRow({ gap, onAsk }: { gap: SkillGap; onAsk: () => void }) {
  const t = useT();
  const { c } = useTheme();

  return (
    <Pressable
      onPress={onAsk}
      accessibilityRole="button"
      accessibilityLabel={`${gap.skill}. ${t('skill.why')}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.gapRow,
        (hovered || pressed) && { backgroundColor: c.surfaceAlt },
        pressed && styles.gapPressed,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: c.primary }]} />
      <Text style={[styles.gapSkill, { color: c.text }]} numberOfLines={1}>
        {gap.skill}
      </Text>
      <Text style={[styles.gapRelevance, { color: c.textMuted }]}>
        {t('skill.relevant', { percent: gap.relevance })}
      </Text>
      <Text style={[styles.gapInfo, { color: c.primary }]}>ⓘ</Text>
    </Pressable>
  );
}

/**
 * Why this skill, in the figures it was actually chosen by.
 *
 * Every line is one of the numbers the recommendation was computed from, so
 * the panel is the working rather than a justification written afterwards. It
 * shows the sample size beside the share — "2 of 11 postings", not a bare
 * 18% — because a percentage hides how much evidence is behind it, and eleven
 * postings is not many.
 *
 * The reference design also asked for "Demand +18% this month". That one is
 * absent: nothing in this product stores what demand was last month, so the
 * arrow could only be decoration. Adding a monthly snapshot of these counts
 * would make it real, and is the obvious next step if the trend matters.
 */
function WhyThisSkill({
  gap,
  path,
  onClose,
}: {
  gap: SkillGap | null;
  path: SkillPath;
  onClose: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();

  if (!gap) return null;

  const facts: { icon: string; line: string }[] = [
    {
      icon: '🔥',
      line: t('skill.why.demand', {
        count: gap.postings,
        total: path.jobsConsidered,
        field: jobCategoryName(path.category, locale),
      }),
    },
  ];

  if (gap.unlocks > 0) {
    facts.push({ icon: '💼', line: t('skill.why.unlocks', { count: gap.unlocks }) });
  } else {
    facts.push({ icon: '💼', line: t('skill.why.noUnlocks') });
  }

  if (gap.pairedWith) {
    facts.push({
      icon: '⭐',
      line: t('skill.why.paired', {
        skill: gap.pairedWith.skill,
        count: gap.pairedWith.jobs,
      }),
    });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stops a tap inside the sheet from closing it — the backdrop is the
            dismiss target, and the sheet sits on top of it. */}
        <Pressable
          style={[styles.sheet, { backgroundColor: c.surface }]}
          onPress={() => undefined}
        >
          <Text style={[styles.sheetEyebrow, { color: c.textMuted }]}>
            {t('skill.why')}
          </Text>
          <Text style={[styles.sheetTitle, { color: c.text }]}>{gap.skill}</Text>

          <View style={styles.factList}>
            {facts.map((fact) => (
              <View key={fact.line} style={styles.factRow}>
                <Text style={styles.factIcon}>{fact.icon}</Text>
                <Text style={[styles.factText, { color: c.text }]}>
                  {fact.line}
                </Text>
              </View>
            ))}
          </View>

          {/* Said plainly rather than left for someone to assume otherwise. */}
          <Text style={[styles.sheetNote, { color: c.textMuted }]}>
            {t('skill.why.basis')}
          </Text>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.sheetClose, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.sheetCloseText, { color: c.primaryText }]}>
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
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },
  explore: { fontSize: font.sm, fontWeight: '800' },

  headline: {
    fontSize: font.md,
    fontWeight: '800',
    marginTop: 12,
    lineHeight: 22,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  basis: { fontSize: font.xs, marginTop: 8, lineHeight: 17 },

  gaps: { marginTop: 14, gap: 10 },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  gapPressed: { opacity: 0.85 },
  gapInfo: { fontSize: font.sm, fontWeight: '800' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: { width: '100%', maxWidth: 420, borderRadius: radius.xl, padding: 20 },
  sheetEyebrow: {
    fontSize: font.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sheetTitle: { fontSize: font.xl, fontWeight: '800', marginTop: 4 },
  factList: { marginTop: 16, gap: 12 },
  factRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  factIcon: { fontSize: font.md, lineHeight: 22 },
  factText: { flex: 1, fontSize: font.sm, lineHeight: 21, fontWeight: '600' },
  sheetNote: { fontSize: font.xs, marginTop: 16, lineHeight: 17 },
  sheetClose: {
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 18,
  },
  sheetCloseText: { fontSize: font.sm, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gapSkill: { flex: 1, fontSize: font.sm, fontWeight: '800' },
  gapRelevance: { fontSize: font.xs, fontWeight: '700' },

  unlock: { fontSize: font.sm, marginTop: 14, lineHeight: 20 },

  cta: {
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 14,
  },
  ctaText: { fontSize: font.sm, fontWeight: '800' },
});
