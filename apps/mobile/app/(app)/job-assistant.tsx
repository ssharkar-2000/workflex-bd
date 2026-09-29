import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { formatTaka, jobCategoryName, type JobDraft } from '@workflex/shared';
import { draftJob } from '../../src/api/job-draft';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { Field, MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useJobDraftStore } from '../../src/store/job-draft-store';
import { useLocale, useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

/**
 * Hiring by describing the job, not by filling in a form.
 *
 * The posting form asks for a category, a job type, a duration, a payment
 * type and a pay range before anyone can be hired. That is a reasonable form
 * for somebody who posts work every week and a wall for the person this is
 * built for: an employer who needs help with their mother for three hours
 * tomorrow and has never filled in a job advert in their life.
 *
 * So they write the sentence they would say out loud, and this turns it into
 * the form's answers. Three things make that safe to do:
 *
 * - Nothing posts itself. The draft goes into the posting form, where every
 *   field is editable and the employer presses the button.
 * - Whatever was filled in without being said is listed, in plain words,
 *   above the button. A guess shown as a fact is how somebody ends up
 *   advertising hours they never agreed to.
 * - The pay range says where it came from. It is measured from open postings
 *   on this platform, not invented.
 */
export default function JobAssistantScreen() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const hand = useJobDraftStore((s) => s.hand);

  const [text, setText] = useState('');

  const draft = useMutation({
    mutationFn: () => draftJob({ text: text.trim() }),
  });

  const result = draft.data;

  return (
    <MoneyScreen title={t('assistant.title')} subtitle={t('assistant.subtitle')}>
      <Field
        label={t('assistant.label')}
        value={text}
        onChange={setText}
        placeholder={t('assistant.placeholder')}
        autoCapitalize="sentences"
      />

      <Pressable
        onPress={() => draft.mutate()}
        disabled={draft.isPending || text.trim().length < 8}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.go,
          {
            backgroundColor: pressed ? c.primaryPressed : c.primary,
            opacity: draft.isPending || text.trim().length < 8 ? 0.6 : 1,
          },
        ]}
      >
        {draft.isPending ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[s.goText, { color: c.primaryText }]}>{t('assistant.make')}</Text>
        )}
      </Pressable>

      {draft.error ? (
        <ErrorBanner message={errorMessage(draft.error)} tone="onSurface" />
      ) : null}

      {result ? (
        <>
          <Text style={[s.heading, { color: c.text }]}>{t('assistant.result')}</Text>

          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[s.jobTitle, { color: c.text }]}>{result.title}</Text>

            <Row
              label={t('assistant.field.category')}
              value={
                result.category
                  ? jobCategoryName(result.category, locale)
                  : t('assistant.unknown')
              }
            />
            <Row label={t('assistant.field.when')} value={result.whenText || t('assistant.unknown')} />
            <Row
              label={t('assistant.field.where')}
              value={result.location || t('assistant.unknown')}
            />
            {result.skills.length > 0 ? (
              <Row label={t('assistant.field.skills')} value={result.skills.join(', ')} />
            ) : null}
            <Row
              label={t('assistant.field.pay')}
              value={
                result.payMin !== null
                  ? `${formatTaka(result.payMin * 100)}${
                      result.payMax && result.payMax !== result.payMin
                        ? ` – ${formatTaka(result.payMax * 100)}`
                        : ''
                    }`
                  : t('assistant.unknown')
              }
            />
            {result.payBasis ? (
              <Text style={[s.basis, { color: c.textMuted }]}>{result.payBasis}</Text>
            ) : null}

            <Text style={[s.description, { color: c.text }]}>{result.description}</Text>
          </View>

          {result.assumptions.length > 0 ? (
            <Notice
              tone="warning"
              title={t('assistant.assumed')}
              body={result.assumptions.join('\n')}
            />
          ) : null}

          <Notice
            tone="info"
            body={t(
              result.source === 'written' ? 'assistant.byModel' : 'assistant.byRules',
            )}
          />

          <Pressable
            onPress={() => {
              hand(result as JobDraft);
              router.push('/(app)/post-job');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.go,
              { backgroundColor: pressed ? c.primaryPressed : c.primary },
            ]}
          >
            <Text style={[s.goText, { color: c.primaryText }]}>
              {t('assistant.continue')}
            </Text>
          </Pressable>

          <Text style={[s.footnote, { color: c.textMuted }]}>
            {t('assistant.footnote')}
          </Text>
        </>
      ) : null}
    </MoneyScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  go: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: space.md,
  },
  goText: { fontSize: font.sm, fontWeight: '800' },

  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  jobTitle: { fontSize: font.md, fontWeight: '800', marginBottom: space.sm },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: 6 },
  rowLabel: { flex: 1, fontSize: font.xs },
  rowValue: { flex: 1.6, fontSize: font.sm, fontWeight: '700' },
  basis: { fontSize: font.xs, lineHeight: 16, marginTop: 2 },
  description: { fontSize: font.sm, lineHeight: 20, marginTop: space.sm },

  footnote: { fontSize: font.xs, lineHeight: 17, marginTop: space.sm },
});
