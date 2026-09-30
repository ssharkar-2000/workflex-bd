import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { fetchSkillPath } from '../../src/api/cv';
import { FreeCourses } from '../../src/components/learning/FreeCourses';
import { NextSkillAI } from '../../src/components/home/NextSkillAI';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * Learning lab: what to learn next, and why.
 *
 * The skill card used to sit on the dashboard among the day's work, where a
 * suggestion about next month competes with a shift starting in an hour and
 * loses. Here it has a screen of its own, with the evidence behind it and
 * the two routes out of a gap — read the CV the platform holds, or look at
 * the postings asking for the skill.
 *
 * What it will never do is name a course or a provider. Nothing in this
 * system knows what training is available in Dhaka or what it costs, and a
 * recommendation with nothing behind it is worse than an honest gap.
 */
export default function LearningLabScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['skill-path'],
    queryFn: fetchSkillPath,
    staleTime: 300_000,
  });

  const path = data?.path;
  const hasGaps = Boolean(path && path.gaps.length > 0);

  return (
    <MoneyScreen title={t('learning.title')} subtitle={t('learning.subtitle')}>
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : hasGaps ? (
        <>
          {/* The card itself, unchanged — it carries its own evidence. */}
          <NextSkillAI />

          {/* And where to go about it. */}
          <FreeCourses />

          <Text style={[s.section, { color: c.text }]}>{t('learning.howItWorks')}</Text>
          <Text style={[s.body, { color: c.textMuted }]}>{t('learning.evidence')}</Text>
        </>
      ) : (
        <>
          <Notice tone="info" body={t('learning.nothingYet')} />

          <Pressable
            onPress={() => router.push('/(app)/cv')}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.action,
              {
                borderColor: c.primarySoftBorder,
                backgroundColor: pressed ? c.primarySoft : 'transparent',
              },
            ]}
          >
            <Text style={[s.actionText, { color: c.primary }]}>{t('learning.addCv')}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(app)/resume')}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.action,
              {
                borderColor: c.primarySoftBorder,
                backgroundColor: pressed ? c.primarySoft : 'transparent',
              },
            ]}
          >
            <Text style={[s.actionText, { color: c.primary }]}>{t('learning.buildCv')}</Text>
          </Pressable>
        </>
      )}
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  section: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },
  body: { fontSize: font.sm, lineHeight: 20 },
  action: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: space.md,
  },
  actionText: { fontSize: font.sm, fontWeight: '800' },
});
