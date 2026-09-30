import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { generateCv, suggestBullets, writeSummary } from '../../../src/api/cv-writer';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { useErrorMessage } from '../../../src/lib/error-message';
import { ResumePreview } from '../../../src/components/resume/ResumePreview';
import { ResumeStrength } from '../../../src/components/resume/ResumeStrength';
import { Field, MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { printResume } from '../../../src/lib/print-resume';
import { resumeHtml } from '../../../src/lib/resume-html';
import { RESUME_SAMPLE } from '../../../src/lib/resume-sample';
import {
  ACCENT_COLOURS,
  newEntry,
  useResumeDraft,
  type ResumeAccent,
  type ResumeDraft,
  type ResumeEntry,
  type ResumeTemplate,
} from '../../../src/lib/resume-draft';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type SectionKey =
  | 'PERSONAL'
  | 'SUMMARY'
  | 'EXPERIENCE'
  | 'PROJECTS'
  | 'EDUCATION'
  | 'SKILLS'
  | 'LANGUAGES'
  | 'CERTIFICATES'
  | 'DESIGN';

const SECTIONS: SectionKey[] = [
  'PERSONAL',
  'SUMMARY',
  'EXPERIENCE',
  'PROJECTS',
  'EDUCATION',
  'SKILLS',
  'LANGUAGES',
  'CERTIFICATES',
  'DESIGN',
];

/** Which list a repeating section edits. */
const LISTS: Partial<Record<SectionKey, 'experience' | 'education' | 'certificates' | 'projects'>> = {
  EXPERIENCE: 'experience',
  PROJECTS: 'projects',
  EDUCATION: 'education',
  CERTIFICATES: 'certificates',
};

const TEMPLATES: ResumeTemplate[] = ['CLASSIC', 'MODERN', 'COMPACT'];
const ACCENTS: ResumeAccent[] = ['AUTO', 'INK', 'INDIGO', 'GREEN', 'ORANGE', 'PLUM'];

/** What the two buttons that throw work away are waiting to be told. */
type Confirming = 'REBUILD' | 'EXAMPLE' | null;

/**
 * Filling the CV in, one section at a time, with the page itself underneath.
 *
 * Sections are collapsed by default and opened one at a time: a CV is nine
 * headings and thirty fields, and showing all of them at once on a phone is
 * how people give up. The preview sits below the form rather than beside it,
 * because there is no beside on a 360pt screen — but it is the real preview,
 * not a thumbnail, so what you type is what you will send.
 *
 * The AI is in three places, deliberately small each time: draft the whole
 * thing when the page is empty, write the summary when that box is the one
 * you are stuck on, and suggest the points for a single job. A helper that
 * only works as "redo everything" is one nobody presses twice.
 *
 * Everything saves itself to the phone as you type. The only thing that
 * leaves the device is what you send to the writer, and what you print.
 */
export default function ResumeBuildScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const { draft, update, replace, dirty, savedAt } = useResumeDraft();
  const [open, setOpen] = useState<SectionKey>('PERSONAL');
  const [drafted, setDrafted] = useState<'written' | 'assembled' | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [pointsFor, setPointsFor] = useState<string | null>(null);
  const [needTitle, setNeedTitle] = useState(false);
  const [variant, setVariant] = useState(0);
  const [printError, setPrintError] = useState(false);

  /**
   * The helper drafts; the person decides.
   *
   * What comes back is merged into the draft rather than replacing it, and
   * every field stays editable — this is a first pass to react to, not a CV
   * anybody should send as it stands. Whether a model phrased it or the
   * account's own details were simply arranged is shown, not glossed over.
   */
  const write = useMutation({
    mutationFn: (fromScratch: boolean) =>
      generateCv({
        targetRole: draft.headline.trim() || undefined,
        // "Rebuild from my profile" asks for the account's own version, so it
        // sends nothing of what is on screen; the button beside the form
        // works around what the person has already written.
        existing: fromScratch
          ? undefined
          : {
              summary: draft.summary,
              headline: draft.headline,
              experience: draft.experience,
              education: draft.education,
              certificates: draft.certificates,
              skills: draft.skills,
              languages: draft.languages,
            },
      }),
    onSuccess: (result) => {
      update({
        summary: result.cv.summary || draft.summary,
        headline: result.cv.headline || draft.headline,
        experience: result.cv.experience.map(withId),
        education: result.cv.education.map(withId),
        certificates: result.cv.certificates.map(withId),
        skills: result.cv.skills.length ? result.cv.skills : draft.skills,
        languages: result.cv.languages.length ? result.cv.languages : draft.languages,
      });
      setDrafted(result.source);
      setOpen('SUMMARY');
    },
  });

  /** The summary alone. Pressing again asks for a different version of it. */
  const summarise = useMutation({
    mutationFn: () =>
      writeSummary({
        headline: draft.headline.trim(),
        years: Number(draft.years) || 0,
        skills: draft.skills,
        variant,
      }),
    onSuccess: (result) => {
      update({ summary: result.summary });
      setDrafted(result.source);
      setVariant((n) => n + 1);
    },
  });

  /** The points for one job, from its title and what this account records. */
  const points = useMutation({
    mutationFn: (entry: ResumeEntry) =>
      suggestBullets({
        role: entry.title.trim(),
        org: entry.org.trim(),
        skills: draft.skills,
      }),
    onSuccess: (result, entry) => {
      patch('experience', entry.id, { detail: result.bullets.join('\n') });
      setDrafted(result.source);
    },
    onSettled: () => setPointsFor(null),
  });

  const download = useMutation({
    mutationFn: async () => {
      const name = draft.fullName.trim() || t('resume.yourName');
      await printResume(
        resumeHtml(draft, {
          summary: t('resume.section.summary'),
          experience: t('resume.section.experience'),
          education: t('resume.section.education'),
          projects: t('resume.section.projects'),
          certificates: t('resume.section.certificates'),
          skills: t('resume.section.skills'),
          languages: t('resume.section.languages'),
          yourName: t('resume.yourName'),
        }),
        `${name} — CV`,
      );
    },
    onError: () => setPrintError(true),
    onSuccess: () => setPrintError(false),
  });

  const setList = (
    key: 'experience' | 'education' | 'certificates' | 'projects',
    rows: ResumeEntry[],
  ) => update({ [key]: rows } as Partial<ResumeDraft>);

  return (
    <MoneyScreen title={t('resume.build')} subtitle={t('resume.savedHere')}>
      {/* Switching the look without going back a screen: the template is a
          decision people revise once their own words are in it. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.templates}
      >
        {TEMPLATES.map((template) => {
          const on = draft.template === template;
          return (
            <Pressable
              key={template}
              onPress={() => update({ template })}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                s.template,
                {
                  borderColor: on ? c.primary : c.border,
                  backgroundColor: on ? c.primarySoft : c.surface,
                },
              ]}
            >
              <Text style={[s.templateText, { color: on ? c.primary : c.textMuted }]}>
                {t(`resume.template.${template}` as TranslationKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.tools}>
        <Tool
          label={download.isPending ? t('resume.downloading') : t('resume.download')}
          onPress={() => download.mutate()}
          disabled={download.isPending}
          primary
        />
        <Tool label={t('resume.rebuild')} onPress={() => setConfirming('REBUILD')} />
        <Tool label={t('resume.example')} onPress={() => setConfirming('EXAMPLE')} />
      </View>

      <Text style={[s.status, { color: c.textMuted }]}>
        {dirty ? t('resume.saving') : savedAt ? t('resume.savedOnDevice') : t('resume.notSavedYet')}
      </Text>

      {printError ? <Notice tone="warning" body={t('resume.downloadFailed')} /> : null}

      {confirming ? (
        <Notice
          tone="warning"
          body={t(confirming === 'REBUILD' ? 'resume.rebuildAsk' : 'resume.exampleAsk')}
        >
          <View style={s.confirmRow}>
            <Tool
              label={t('resume.replaceIt')}
              onPress={() => {
                if (confirming === 'EXAMPLE') replace(RESUME_SAMPLE);
                else write.mutate(true);
                setConfirming(null);
              }}
              primary
            />
            <Tool label={t('common.cancel')} onPress={() => setConfirming(null)} />
          </View>
        </Notice>
      ) : null}

      <ResumeStrength draft={draft} />

      {/* The helper, above the form it fills in. */}
      <Pressable
        onPress={() => write.mutate(false)}
        disabled={write.isPending}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.ai,
          {
            borderColor: c.aiSoftBorder,
            backgroundColor: pressed ? c.aiSoft : 'transparent',
          },
        ]}
      >
        {write.isPending ? (
          <ActivityIndicator color={c.ai} />
        ) : (
          <Text style={[s.aiText, { color: c.ai }]}>{t('resume.writeWithAi')}</Text>
        )}
      </Pressable>

      {write.error ? (
        <ErrorBanner message={errorMessage(write.error)} tone="onSurface" />
      ) : null}
      {summarise.error ? (
        <ErrorBanner message={errorMessage(summarise.error)} tone="onSurface" />
      ) : null}
      {points.error ? (
        <ErrorBanner message={errorMessage(points.error)} tone="onSurface" />
      ) : null}

      {drafted ? (
        <Notice
          tone="info"
          body={t(drafted === 'written' ? 'resume.aiWrote' : 'resume.aiAssembled')}
        />
      ) : null}

      {SECTIONS.map((section) => {
        const isOpen = open === section;
        const list = LISTS[section];

        return (
          <View
            key={section}
            style={[s.section, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Pressable
              onPress={() => setOpen(isOpen ? ('PERSONAL' as SectionKey) : section)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={s.head}
            >
              <Text style={[s.headText, { color: c.text }]}>
                {t(`resume.section.${section}` as TranslationKey)}
              </Text>
              <Text style={[s.chevron, { color: c.textMuted }]}>{isOpen ? '−' : '+'}</Text>
            </Pressable>

            {isOpen ? (
              <View style={s.body}>
                {section === 'PERSONAL' ? (
                  <>
                    <Field
                      label={t('resume.field.fullName')}
                      value={draft.fullName}
                      onChange={(v) => update({ fullName: v })}
                    />
                    <Field
                      label={t('resume.field.headline')}
                      value={draft.headline}
                      onChange={(v) => update({ headline: v })}
                      placeholder={t('resume.field.headlineHint')}
                    />
                    <Field
                      label={t('resume.field.years')}
                      value={draft.years}
                      onChange={(v) => update({ years: v.replace(/[^0-9]/g, '').slice(0, 2) })}
                      placeholder={t('resume.field.yearsHint')}
                      keyboardType="number-pad"
                      optional
                    />
                    <Field
                      label={t('resume.field.phone')}
                      value={draft.phone}
                      onChange={(v) => update({ phone: v })}
                      keyboardType="phone-pad"
                    />
                    <Field
                      label={t('resume.field.email')}
                      value={draft.email}
                      onChange={(v) => update({ email: v })}
                      optional
                      autoCapitalize="none"
                    />
                    <Field
                      label={t('resume.field.location')}
                      value={draft.location}
                      onChange={(v) => update({ location: v })}
                    />
                    <Field
                      label={t('resume.field.link')}
                      value={draft.link}
                      onChange={(v) => update({ link: v })}
                      optional
                      autoCapitalize="none"
                    />
                  </>
                ) : null}

                {section === 'SUMMARY' ? (
                  <>
                    <Field
                      label={t('resume.field.summary')}
                      value={draft.summary}
                      onChange={(v) => update({ summary: v })}
                      placeholder={t('resume.field.summaryHint')}
                      autoCapitalize="sentences"
                    />
                    <Pressable
                      onPress={() => summarise.mutate()}
                      disabled={summarise.isPending}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        s.mini,
                        {
                          borderColor: c.aiSoftBorder,
                          backgroundColor: pressed ? c.aiSoft : 'transparent',
                        },
                      ]}
                    >
                      {summarise.isPending ? (
                        <ActivityIndicator color={c.ai} size="small" />
                      ) : (
                        <Text style={[s.miniText, { color: c.ai }]}>
                          {t(variant === 0 ? 'resume.writeSummary' : 'resume.writeSummaryAgain')}
                        </Text>
                      )}
                    </Pressable>
                    <Text style={[s.hint, { color: c.textMuted }]}>
                      {t('resume.summaryHelp')}
                    </Text>
                  </>
                ) : null}

                {list ? (
                  <>
                    {draft[list].map((entry, index) => (
                      <View key={entry.id} style={[s.entry, { borderColor: c.border }]}>
                        <View style={s.entryHead}>
                          <Text style={[s.entryNo, { color: c.textMuted }]}>
                            {index + 1}
                          </Text>
                          <Pressable
                            onPress={() =>
                              setList(
                                list,
                                draft[list].filter((row) => row.id !== entry.id),
                              )
                            }
                            accessibilityRole="button"
                            hitSlop={8}
                          >
                            <Text style={[s.remove, { color: c.danger }]}>
                              {t('resume.remove')}
                            </Text>
                          </Pressable>
                        </View>

                        <Field
                          label={t(`resume.entry.${section}.title` as TranslationKey)}
                          value={entry.title}
                          onChange={(v) => patch(list, entry.id, { title: v })}
                        />
                        <Field
                          label={t(`resume.entry.${section}.org` as TranslationKey)}
                          value={entry.org}
                          onChange={(v) => patch(list, entry.id, { org: v })}
                        />
                        <View style={s.dates}>
                          <View style={s.grow}>
                            <Field
                              label={t('resume.entry.from')}
                              value={entry.from}
                              onChange={(v) => patch(list, entry.id, { from: v })}
                              placeholder="2022"
                            />
                          </View>
                          <View style={s.grow}>
                            <Field
                              label={t('resume.entry.to')}
                              value={entry.to}
                              onChange={(v) => patch(list, entry.id, { to: v })}
                              placeholder={t('resume.entry.now')}
                            />
                          </View>
                        </View>
                        <Field
                          label={t('resume.entry.detail')}
                          value={entry.detail}
                          onChange={(v) => patch(list, entry.id, { detail: v })}
                          placeholder={t('resume.entry.detailHint')}
                          optional
                          autoCapitalize="sentences"
                        />

                        {/* Only for jobs: a certificate has no duties, and a
                            school is not something the writer can describe. */}
                        {section === 'EXPERIENCE' ? (
                          <Pressable
                            onPress={() => {
                              if (!entry.title.trim()) {
                                setNeedTitle(true);
                                return;
                              }
                              setNeedTitle(false);
                              setPointsFor(entry.id);
                              points.mutate(entry);
                            }}
                            disabled={points.isPending}
                            accessibilityRole="button"
                            style={({ pressed }) => [
                              s.mini,
                              {
                                borderColor: c.aiSoftBorder,
                                backgroundColor: pressed ? c.aiSoft : 'transparent',
                              },
                            ]}
                          >
                            {pointsFor === entry.id ? (
                              <ActivityIndicator color={c.ai} size="small" />
                            ) : (
                              <Text style={[s.miniText, { color: c.ai }]}>
                                {t('resume.suggestPoints')}
                              </Text>
                            )}
                          </Pressable>
                        ) : null}
                      </View>
                    ))}

                    {section === 'EXPERIENCE' && needTitle ? (
                      <Notice tone="warning" body={t('resume.needTitleFirst')} />
                    ) : null}

                    <Pressable
                      onPress={() => setList(list, [...draft[list], newEntry()])}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        s.add,
                        {
                          borderColor: c.primarySoftBorder,
                          backgroundColor: pressed ? c.primarySoft : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[s.addText, { color: c.primary }]}>
                        {t(`resume.add.${section}` as TranslationKey)}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {section === 'SKILLS' ? (
                  <Field
                    label={t('resume.field.skills')}
                    value={draft.skills.join(', ')}
                    onChange={(v) => update({ skills: splitList(v) })}
                    placeholder={t('resume.field.skillsHint')}
                    autoCapitalize="none"
                  />
                ) : null}

                {section === 'LANGUAGES' ? (
                  <Field
                    label={t('resume.field.languages')}
                    value={draft.languages.join(', ')}
                    onChange={(v) => update({ languages: splitList(v) })}
                    placeholder="বাংলা, English"
                    autoCapitalize="none"
                  />
                ) : null}

                {section === 'DESIGN' ? (
                  <>
                    <Text style={[s.hint, { color: c.textMuted }]}>
                      {t('resume.design.colourHelp')}
                    </Text>
                    <View style={s.swatches}>
                      {ACCENTS.map((accent) => {
                        const on = draft.accent === accent;
                        const swatch =
                          accent === 'AUTO' ? null : ACCENT_COLOURS[accent];
                        return (
                          <Pressable
                            key={accent}
                            onPress={() => update({ accent })}
                            accessibilityRole="button"
                            accessibilityLabel={t(`resume.accent.${accent}` as TranslationKey)}
                            accessibilityState={{ selected: on }}
                            style={[
                              s.swatch,
                              {
                                borderColor: on ? c.primary : c.border,
                                borderWidth: on ? 2 : 1,
                                backgroundColor: swatch ?? c.surfaceAlt,
                              },
                            ]}
                          >
                            {swatch ? null : (
                              <Text style={[s.swatchAuto, { color: c.textMuted }]}>A</Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={[s.hint, { color: c.textMuted }]}>
                      {t(`resume.accent.${draft.accent}` as TranslationKey)}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={[s.previewTitle, { color: c.text }]}>{t('resume.preview')}</Text>
      <View style={[s.preview, { borderColor: c.border }]}>
        <ResumePreview draft={draft} />
      </View>
    </MoneyScreen>
  );

  function patch(
    key: 'experience' | 'education' | 'certificates' | 'projects',
    id: string,
    changes: Partial<ResumeEntry>,
  ) {
    setList(
      key,
      draft[key].map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  }
}

/** One of the small buttons along the top. */
function Tool({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.tool,
        {
          borderColor: primary ? c.primary : c.border,
          backgroundColor: pressed || primary ? c.primarySoft : 'transparent',
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[s.toolText, { color: primary ? c.primary : c.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

/** "cooking, rostering ,stock" → three skills, no blanks. */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const s = StyleSheet.create({
  templates: { gap: space.sm, paddingVertical: space.sm },
  template: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  templateText: { fontSize: font.xs, fontWeight: '800' },

  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tool: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  toolText: { fontSize: font.xs, fontWeight: '800' },
  status: { fontSize: font.xs, marginTop: space.xs },
  confirmRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },

  ai: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  aiText: { fontSize: font.sm, fontWeight: '800' },
  mini: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginTop: space.xs,
  },
  miniText: { fontSize: font.xs, fontWeight: '800' },
  hint: { fontSize: font.xs, lineHeight: 17, marginTop: space.xs },

  section: { borderWidth: 1, borderRadius: radius.lg, marginTop: space.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
  },
  headText: { fontSize: font.md, fontWeight: '700' },
  chevron: { fontSize: font.lg, fontWeight: '800' },
  body: { paddingHorizontal: space.md, paddingBottom: space.md },

  entry: { borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginBottom: space.sm },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryNo: { fontSize: font.xs, fontWeight: '800' },
  remove: { fontSize: font.xs, fontWeight: '800' },
  dates: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },

  add: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginTop: space.xs,
  },
  addText: { fontSize: font.sm, fontWeight: '800' },

  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchAuto: { fontSize: font.sm, fontWeight: '800' },

  previewTitle: { fontSize: font.lg, fontWeight: '800', marginTop: space.lg, marginBottom: space.sm },
  preview: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
});

/** The builder keys its rows by id; a drafted entry arrives without one. */
function withId(row: Omit<ResumeEntry, 'id'>): ResumeEntry {
  return { ...newEntry(), ...row };
}
