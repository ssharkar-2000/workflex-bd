import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { skillPathResponseSchema, type SkillPathResponse } from '@workflex/shared';
import { api } from '../../api/client';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

async function fetchSkillPath(): Promise<SkillPathResponse> {
  const { data } = await api.get('/cv/skill-path');
  return skillPathResponseSchema.parse(data);
}

/**
 * NextSkill AI: how far this CV is from the work it is aimed at.
 *
 * The percentage is overlap with the skills open postings in that field are
 * asking for right now — deliberately not "employability". Overlap with live
 * advertisements is a narrow, checkable claim; readiness for work is a
 * judgement about a person that no count of keywords can support.
 *
 * The chips are the skills that field asks for and this CV does not have,
 * each with the share of postings naming it, so the order is arguable rather
 * than mysterious. Hides itself when there is no CV or nothing in the field
 * to measure against, instead of inventing a target to be short of.
 */
export function NextSkillBanner() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const { data } = useQuery({
    queryKey: ['skill-path'],
    queryFn: fetchSkillPath,
    staleTime: 600_000,
  });

  const path = data?.path;
  if (!path || path.gaps.length === 0) return null;

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.brand, { color: c.ai ?? c.primary }]}>{t('next.brand')}</Text>

      <Text style={[s.headline, { color: c.text }]}>
        {t('next.matched', { pct: path.readiness, role: path.targetRole })}
      </Text>
      <Text style={[s.from, { color: c.textMuted }]}>
        {t('next.from', { n: path.jobsConsidered })}
      </Text>

      <Text style={[s.label, { color: c.textMuted }]}>{t('next.recommended')}</Text>
      {/*
        Horizontal rather than wrapped: the chips are ordered by how much of
        the field asks for each one, and a wrap puts the fourth-most-wanted
        skill above the second on a narrow screen, which loses the ordering
        that is the whole point.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {path.gaps.slice(0, 5).map((gap) => (
          <View
            key={gap.skill}
            style={[s.chip, { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder }]}
          >
            <Text style={[s.chipName, { color: c.primary }]}>{gap.skill}</Text>
            <Text style={[s.chipPct, { color: c.textMuted }]}>{gap.relevance}%</Text>
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/(app)/learning')}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.button,
          { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={s.buttonText}>{t('next.explore')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  brand: { fontSize: font.xs, fontWeight: '900', letterSpacing: 0.4 },
  headline: { fontSize: font.sm + 1, fontWeight: '800', lineHeight: 21, marginTop: 4 },
  from: { fontSize: font.xs - 1, marginTop: 3 },

  label: { fontSize: font.xs - 1, fontWeight: '800', letterSpacing: 0.3, marginTop: space.md },
  chips: { flexDirection: 'row', gap: 7, paddingVertical: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 6,
  },
  chipName: { fontSize: font.xs, fontWeight: '800' },
  chipPct: { fontSize: font.xs - 1, fontWeight: '700' },

  button: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    marginTop: space.sm,
  },
  buttonText: { color: '#FFFFFF', fontSize: font.xs, fontWeight: '800' },
});
