import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { achievementsSchema, type Achievements } from '@workflex/shared';
import { api } from '../../api/client';
import { fetchTrustScore } from '../../api/auth';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

async function fetchAchievements(): Promise<Achievements> {
  const { data } = await api.get('/users/achievements');
  return achievementsSchema.parse(data);
}

/**
 * The four things a profile is made of, as rows.
 *
 * Two of them lead to screens of their own; two scroll to cards already on
 * this page. That asymmetry is deliberate — moving the edit form and the
 * verification cards onto separate routes would mean three taps to change a
 * phone number, and the people using this app are not browsing.
 */
const SECTIONS = [
  { key: 'personal', to: null, labelKey: 'profile.s.personal', hintKey: 'profile.s.personalHint' },
  { key: 'skills', to: '/(app)/cv', labelKey: 'profile.s.skills', hintKey: 'profile.s.skillsHint' },
  { key: 'docs', to: null, labelKey: 'profile.s.docs', hintKey: 'profile.s.docsHint' },
  {
    key: 'prefs',
    to: '/(app)/achievements',
    labelKey: 'profile.s.prefs',
    hintKey: 'profile.s.prefsHint',
  },
] as const;

/**
 * The strip at the top of the profile: rating, trust and work done.
 *
 * All three are counted from the record — reviews left by people who hired
 * this account, the trust score those same records feed, and completed
 * shifts. A dash rather than a zero where nothing has happened yet: zero
 * reads as a judgement, and "—" reads as what it is, which is silence.
 */
export function ProfileStats() {
  const t = useT();
  const { c } = useTheme();

  const { data } = useQuery({
    queryKey: ['achievements'],
    queryFn: fetchAchievements,
    staleTime: 300_000,
  });
  // Its own query rather than a prop: the trust card lower down already
  // fetches this, so react-query serves both from one request.
  const trust = useQuery({ queryKey: ['trust'], queryFn: fetchTrustScore, staleTime: 300_000 });
  const trustScore = trust.data?.score ?? null;

  const rating = data?.stats.avgRating;
  const jobs = data?.stats.completedJobs ?? 0;

  return (
    <View style={s.stats}>
      <Stat value={rating === null || rating === undefined ? '—' : String(rating)} label={t('profile.st.rating')} />
      <Stat
        value={trustScore === null || trustScore === undefined ? '—' : String(trustScore)}
        label={t('profile.st.trust')}
      />
      <Stat value={String(jobs)} label={t('profile.st.jobs')} />
    </View>
  );
}

/**
 * The four section rows.
 *
 * `onScrollTo` is given the key of a card further down the page, so a row
 * that has no screen of its own still goes somewhere rather than doing
 * nothing when tapped.
 */
export function ProfileSections({
  onScrollTo,
}: {
  onScrollTo: (key: 'personal' | 'docs') => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  return (
    <View style={s.sections}>
      {SECTIONS.map((section) => (
        <Pressable
          key={section.key}
          onPress={() => {
            if (section.to) router.push(section.to as never);
            else onScrollTo(section.key as 'personal' | 'docs');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.row,
            {
              backgroundColor: pressed ? c.surfaceAlt : c.surface,
              borderColor: c.border,
            },
          ]}
        >
          <View style={s.rowBody}>
            <Text style={[s.rowLabel, { color: c.text }]}>
              {t(section.labelKey as TranslationKey)}
            </Text>
            <Text style={[s.rowHint, { color: c.textMuted }]} numberOfLines={1}>
              {t(section.hintKey as TranslationKey)}
            </Text>
          </View>
          <Text style={[s.chevron, { color: c.textMuted }]}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.statValue, { color: c.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    alignItems: 'center',
  },
  statValue: { fontSize: font.lg, fontWeight: '900' },
  statLabel: { fontSize: font.xs - 1, lineHeight: 14, textAlign: 'center', marginTop: 2 },

  sections: { marginTop: space.md, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: font.sm, fontWeight: '800' },
  rowHint: { fontSize: font.xs, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '700' },
});
