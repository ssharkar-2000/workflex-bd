import { StyleSheet, Text, View } from 'react-native';
import type { ResumeDraft } from '../../lib/resume-draft';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * How finished the CV is, and what is missing.
 *
 * A builder can tell you a field is empty; it cannot tell you your CV is thin.
 * This does, by scoring the ten things an employer looks for and naming the
 * ones that are not there yet — which turns "I have written something" into
 * "I have written enough", the question people actually cannot answer about
 * their own CV.
 *
 * The weights are not equal because the sections are not: a summary and five
 * skills change whether a CV gets read at all, while a certificate is a nice
 * addition. Nothing here blocks anything — a 60% CV still prints.
 */

type Check = { key: TranslationKey; done: boolean; points: number };

export function checksFor(draft: ResumeDraft): Check[] {
  const filled = (value: string) => value.trim().length > 0;

  return [
    { key: 'resume.strength.name', done: filled(draft.fullName) && filled(draft.headline), points: 10 },
    { key: 'resume.strength.contact', done: filled(draft.phone) && filled(draft.location), points: 10 },
    { key: 'resume.strength.summary', done: draft.summary.trim().length >= 40, points: 15 },
    { key: 'resume.strength.skills', done: draft.skills.length >= 5, points: 15 },
    {
      key: 'resume.strength.experience',
      // A job with no detail lines is a job title, not experience.
      done: draft.experience.some((row) => filled(row.title) && filled(row.detail)),
      points: 15,
    },
    {
      key: 'resume.strength.education',
      done: draft.education.some((row) => filled(row.title) || filled(row.org)),
      points: 10,
    },
    { key: 'resume.strength.projects', done: draft.projects.some((row) => filled(row.title)), points: 10 },
    {
      key: 'resume.strength.certificates',
      done: draft.certificates.some((row) => filled(row.title)),
      points: 5,
    },
    { key: 'resume.strength.languages', done: draft.languages.length > 0, points: 5 },
    { key: 'resume.strength.email', done: filled(draft.email) || filled(draft.link), points: 5 },
  ];
}

export function ResumeStrength({ draft }: { draft: ResumeDraft }) {
  const t = useT();
  const { c } = useTheme();

  const checks = checksFor(draft);
  const score = checks.reduce((total, check) => total + (check.done ? check.points : 0), 0);
  const missing = checks.filter((check) => !check.done);

  // Red below a third, amber under two thirds, green above: the same reading
  // the person would give it themselves.
  const tone = score >= 70 ? c.success : score >= 35 ? c.warning : c.danger;

  return (
    <View style={[s.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.top}>
        <Text style={[s.title, { color: c.text }]}>{t('resume.strength.title')}</Text>
        <Text style={[s.score, { color: tone }]}>{score}%</Text>
      </View>

      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
        <View style={[s.fill, { width: `${score}%`, backgroundColor: tone }]} />
      </View>

      <Text style={[s.hint, { color: c.textMuted }]}>
        {missing.length === 0
          ? t('resume.strength.full')
          : t('resume.strength.hint', {
              // Four is as many as anyone acts on at once; the rest come back
              // as they are ticked off.
              items: missing
                .slice(0, 4)
                .map((check) => t(check.key))
                .join(', '),
            })}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.xs,
    marginTop: space.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: font.sm, fontWeight: '800' },
  score: { fontSize: font.md, fontWeight: '800' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  hint: { fontSize: font.xs, lineHeight: 17 },
});
