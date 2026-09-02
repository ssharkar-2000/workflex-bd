import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { jobCategoryName, type SkillGap } from '@workflex/shared';
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
            <GapRow key={gap.skill} gap={gap} />
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
    </View>
  );
}

function GapRow({ gap }: { gap: SkillGap }) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={styles.gapRow}>
      <View style={[styles.dot, { backgroundColor: c.primary }]} />
      <Text style={[styles.gapSkill, { color: c.text }]} numberOfLines={1}>
        {gap.skill}
      </Text>
      <Text style={[styles.gapRelevance, { color: c.textMuted }]}>
        {t('skill.relevant', { percent: gap.relevance })}
      </Text>
    </View>
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
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
