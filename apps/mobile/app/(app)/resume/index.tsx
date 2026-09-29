import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchCvStatus } from '../../../src/api/cv';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/** What the builder does, in the order somebody cares about it. */
const FEATURES = [
  { key: 'ats', label: 'resume.f.ats', hint: 'resume.f.atsHint' },
  { key: 'smart', label: 'resume.f.smart', hint: 'resume.f.smartHint' },
  { key: 'templates', label: 'resume.f.templates', hint: 'resume.f.templatesHint' },
  { key: 'edit', label: 'resume.f.edit', hint: 'resume.f.editHint' },
] as const;

/**
 * The way into the CV tools.
 *
 * Two doors, and which one somebody needs depends on whether they already
 * have a CV. Building one from nothing and improving one that exists are
 * different jobs with different first questions, and a single "CV" button
 * that guesses gets it wrong half the time.
 *
 * The four lines under the heading are what the builder actually does, not
 * a sales pitch — "works with the machines that read CVs" is a fact about
 * the output, and somebody deciding whether to spend ten minutes here has a
 * right to know it before they start rather than after.
 */
export default function ResumeHomeScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const cv = useQuery({ queryKey: ['cv'], queryFn: fetchCvStatus });
  const hasCv = cv.data?.hasCv ?? false;

  return (
    <MoneyScreen title={t('resume.title')} subtitle={t('resume.subtitle')}>
      <View style={s.features}>
        {FEATURES.map((feature) => (
          <View
            key={feature.key}
            style={[s.feature, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[s.featureLabel, { color: c.text }]}>
              {t(feature.label as TranslationKey)}
            </Text>
            <Text style={[s.featureHint, { color: c.textMuted }]}>
              {t(feature.hint as TranslationKey)}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.action}>
        <ShimmerButton
          label={t('resume.create')}
          onPress={() => router.push('/(app)/resume/build')}
        />
      </View>

      {/*
        The analyser sits behind its own door rather than inside the builder.
        Somebody who already has a CV is not here to write one — they want to
        know what is wrong with the one they have, and being walked through a
        four-step wizard first would be a waste of their evening.
      */}
      <Pressable
        onPress={() => router.push('/(app)/resume/analyze')}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.analyze,
          { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : c.surface },
        ]}
      >
        <Text style={[s.analyzeTitle, { color: c.primary }]}>{t('resume.analyze')}</Text>
        <Text style={[s.analyzeHint, { color: c.textMuted }]}>
          {hasCv ? t('resume.analyzeHint') : t('resume.analyzeNoCv')}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(app)/cv')}
        accessibilityRole="button"
        hitSlop={8}
        style={s.upload}
      >
        <Text style={[s.uploadText, { color: c.textMuted }]}>
          {t('resume.haveOne')}{' '}
          <Text style={{ color: c.primary, fontWeight: '800' }}>{t('resume.upload')}</Text>
        </Text>
      </Pressable>
    </MoneyScreen>
  );
}

const s = StyleSheet.create({
  features: { gap: space.sm, marginTop: space.md },
  feature: { borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  featureLabel: { fontSize: font.sm, fontWeight: '800' },
  featureHint: { fontSize: font.xs, lineHeight: 16, marginTop: 2 },

  action: { marginTop: space.lg },

  analyze: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
  },
  analyzeTitle: { fontSize: font.sm + 1, fontWeight: '800' },
  analyzeHint: { fontSize: font.xs, lineHeight: 16, marginTop: 2 },

  upload: { alignSelf: 'center', marginTop: space.lg },
  uploadText: { fontSize: font.xs + 1 },
});
