import { StyleSheet, Text, View } from 'react-native';
import type { ResumeDraft, ResumeEntry } from '../../lib/resume-draft';
import { accentFor } from '../../lib/resume-html';
import { useT } from '../../i18n';
import { font, radius, space } from '../../lib/theme';

/**
 * The CV as it will read, drawn the way a printed page looks: white, dark
 * text, one column, whatever the app's theme is.
 *
 * A preview that followed the app into dark mode would be lying about the
 * document — this is a piece of paper someone will send to an employer, and
 * it is white in every template.
 *
 * The three templates differ in what a reader notices first: Classic leads
 * with the name in a serif-weight stack, Modern puts the name on a coloured
 * band, Compact trades the band for more room on a small screen.
 */
export function ResumePreview({
  draft,
  scale = 1,
}: {
  draft: ResumeDraft;
  scale?: number;
}) {
  const t = useT();
  const size = (value: number) => Math.round(value * scale);
  // Resolved by the same function the printed page uses, so the preview can
  // never show one colour and the PDF another.
  const accent = accentFor(draft);

  const contact = [draft.phone, draft.email, draft.location, draft.link]
    .filter((part) => part.trim())
    .join('  ·  ');

  return (
    <View style={[s.page, { padding: size(20) }]}>
      {draft.template === 'MODERN' ? (
        <View style={[s.band, { backgroundColor: accent, padding: size(14) }]}>
          <Text style={[s.nameOnBand, { fontSize: size(22) }]} numberOfLines={1}>
            {draft.fullName || t('resume.yourName')}
          </Text>
          {draft.headline ? (
            <Text style={[s.headlineOnBand, { fontSize: size(12) }]} numberOfLines={1}>
              {draft.headline}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <Text
            style={[
              s.name,
              {
                fontSize: size(draft.template === 'COMPACT' ? 20 : 24),
                letterSpacing: draft.template === 'CLASSIC' ? 0.4 : 0,
              },
            ]}
            numberOfLines={1}
          >
            {draft.fullName || t('resume.yourName')}
          </Text>
          {draft.headline ? (
            <Text style={[s.headline, { fontSize: size(12), color: accent }]}>
              {draft.headline}
            </Text>
          ) : null}
        </>
      )}

      {contact ? (
        <Text style={[s.contact, { fontSize: size(10), marginTop: size(6) }]}>{contact}</Text>
      ) : null}

      {draft.summary ? (
        <Section title={t('resume.section.summary')} accent={accent} size={size}>
          <Text style={[s.body, { fontSize: size(10) }]}>{draft.summary}</Text>
        </Section>
      ) : null}

      {draft.experience.length > 0 ? (
        <Section title={t('resume.section.experience')} accent={accent} size={size}>
          {draft.experience.map((entry) => (
            <Entry key={entry.id} entry={entry} size={size} />
          ))}
        </Section>
      ) : null}

      {draft.projects.length > 0 ? (
        <Section title={t('resume.section.projects')} accent={accent} size={size}>
          {draft.projects.map((entry) => (
            <Entry key={entry.id} entry={entry} size={size} />
          ))}
        </Section>
      ) : null}

      {draft.education.length > 0 ? (
        <Section title={t('resume.section.education')} accent={accent} size={size}>
          {draft.education.map((entry) => (
            <Entry key={entry.id} entry={entry} size={size} />
          ))}
        </Section>
      ) : null}

      {draft.certificates.length > 0 ? (
        <Section title={t('resume.section.certificates')} accent={accent} size={size}>
          {draft.certificates.map((entry) => (
            <Entry key={entry.id} entry={entry} size={size} />
          ))}
        </Section>
      ) : null}

      {draft.skills.length > 0 ? (
        <Section title={t('resume.section.skills')} accent={accent} size={size}>
          <View style={s.wrap}>
            {draft.skills.map((skill) => (
              <Text key={skill} style={[s.chip, { fontSize: size(10) }]}>
                {skill}
              </Text>
            ))}
          </View>
        </Section>
      ) : null}

      {draft.languages.length > 0 ? (
        <Section title={t('resume.section.languages')} accent={accent} size={size}>
          <Text style={[s.body, { fontSize: size(10) }]}>{draft.languages.join(', ')}</Text>
        </Section>
      ) : null}
    </View>
  );
}

function Section({
  title,
  accent,
  size,
  children,
}: {
  title: string;
  accent: string;
  size: (value: number) => number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: size(14) }}>
      <Text style={[s.sectionTitle, { fontSize: size(11), color: accent }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[s.rule, { backgroundColor: accent, marginBottom: size(6) }]} />
      {children}
    </View>
  );
}

function Entry({
  entry,
  size,
}: {
  entry: ResumeEntry;
  size: (value: number) => number;
}) {
  const dates = [entry.from, entry.to].filter((part) => part.trim()).join(' – ');
  const where = [entry.org, entry.place].filter((part) => part.trim()).join(', ');

  return (
    <View style={{ marginBottom: size(8) }}>
      <View style={s.entryTop}>
        <Text style={[s.entryTitle, { fontSize: size(11) }]} numberOfLines={1}>
          {entry.title}
        </Text>
        {dates ? <Text style={[s.entryDates, { fontSize: size(9) }]}>{dates}</Text> : null}
      </View>
      {where ? <Text style={[s.entryOrg, { fontSize: size(10) }]}>{where}</Text> : null}
      {entry.detail
        ? entry.detail
            .split('\n')
            .filter((line) => line.trim())
            .map((line, i) => (
              <Text key={i} style={[s.bullet, { fontSize: size(10) }]}>
                •  {line.trim()}
              </Text>
            ))
        : null}
    </View>
  );
}

const s = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', borderRadius: radius.md },
  band: { borderRadius: radius.sm, marginBottom: 2 },
  nameOnBand: { color: '#FFFFFF', fontWeight: '800' },
  headlineOnBand: { color: 'rgba(255,255,255,0.88)' },

  name: { color: '#111120', fontWeight: '800' },
  headline: { fontWeight: '600', marginTop: 2 },
  contact: { color: '#4A4A63' },

  sectionTitle: { fontWeight: '800', letterSpacing: 0.8 },
  rule: { height: 1, marginTop: 3, opacity: 0.35 },

  body: { color: '#22223B', lineHeight: 16 },
  bullet: { color: '#22223B', lineHeight: 15, marginTop: 1 },

  entryTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  entryTitle: { flex: 1, color: '#111120', fontWeight: '700' },
  entryDates: { color: '#6B6B85' },
  entryOrg: { color: '#4A4A63', marginTop: 1 },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    color: '#22223B',
    backgroundColor: '#F1EFF7',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
