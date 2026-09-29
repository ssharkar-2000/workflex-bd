import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { MockGroup, MockSubject } from '@workflex/shared';
import { fetchSubjects } from '../../../src/api/mock';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type Filter = 'ALL' | MockGroup;
const FILTERS: Filter[] = ['ALL', 'TECHNICAL', 'NON_TECHNICAL', 'LANGUAGE'];

/**
 * The mock test home, and the chooser in the same place.
 *
 * The mockup keeps them on separate screens. They are one here because the
 * chooser *is* the home screen's content — a list of tests with a list of
 * recommended tests above it, on a phone, is the same list twice with a tap
 * in between. Recommended ones are marked in place instead.
 *
 * What the screen says up front is what the test is not: nothing here goes
 * to an employer or onto a profile. A person who thinks a practice score
 * might be held against them will not take one honestly, and a test nobody
 * answers honestly measures nothing.
 */
export default function MockHomeScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [filter, setFilter] = useState<Filter>('ALL');

  const subjects = useQuery({ queryKey: ['mock-subjects'], queryFn: fetchSubjects });

  const all = subjects.data?.subjects ?? [];
  const shown = filter === 'ALL' ? all : all.filter((one) => one.group === filter);
  const recommended = all.filter((one) => one.recommended);

  return (
    <MoneyScreen title={t('mock.title')} subtitle={t('mock.subtitle')}>
      {subjects.error ? (
        <ErrorBanner message={errorMessage(subjects.error)} tone="onSurface" />
      ) : null}

      <Notice tone="info" body={t('mock.privateNote')} />

      {subjects.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (
        <>
          {subjects.data && subjects.data.taken > 0 ? (
            <Pressable
              onPress={() => router.push('/(app)/mock/progress')}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.progress,
                { borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : c.surface },
              ]}
            >
              <Text style={[s.progressText, { color: c.text }]}>
                {t('mock.takenCount', { n: subjects.data.taken })}
              </Text>
              <Text style={[s.progressLink, { color: c.primary }]}>
                {t('mock.seeProgress')} ›
              </Text>
            </Pressable>
          ) : null}

          {recommended.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.recommended')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('mock.recommendedNote')}</Text>
              {recommended.map((subject) => (
                <SubjectRow
                  key={`r-${subject.key}`}
                  subject={subject}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/mock/[subject]',
                      params: { subject: subject.key },
                    })
                  }
                />
              ))}
            </>
          ) : null}

          <Text style={[s.heading, { color: c.text }]}>{t('mock.chooseTitle')}</Text>
          <Text style={[s.note, { color: c.textMuted }]}>{t('mock.chooseNote')}</Text>

          <View style={s.chips}>
            {FILTERS.map((one) => (
              <Pressable
                key={one}
                onPress={() => setFilter(one)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === one }}
                style={({ pressed }) => [
                  s.chip,
                  {
                    backgroundColor:
                      filter === one ? c.primarySoft : pressed ? c.surfaceAlt : 'transparent',
                    borderColor: filter === one ? c.primary : c.border,
                  },
                ]}
              >
                <Text
                  style={[s.chipText, { color: filter === one ? c.primary : c.textMuted }]}
                >
                  {t(`mock.group.${one}` as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {shown.map((subject) => (
            <SubjectRow
              key={subject.key}
              subject={subject}
              onPress={() =>
                router.push({
                  pathname: '/(app)/mock/[subject]',
                  params: { subject: subject.key },
                })
              }
            />
          ))}
        </>
      )}

      <Text style={[s.note, { color: c.textMuted }]}>{t('mock.footnote')}</Text>
    </MoneyScreen>
  );
}

function SubjectRow({ subject, onPress }: { subject: MockSubject; onPress: () => void }) {
  const t = useT();
  const { c } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: pressed ? c.surfaceAlt : c.surface,
          borderColor: subject.recommended ? c.primary : c.border,
        },
      ]}
    >
      <View style={s.rowBody}>
        <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>
          {subject.title}
        </Text>
        <Text style={[s.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
          {t('mock.testsAnd', {
            tests: subject.tests,
            min: subject.minMinutes,
            max: subject.maxMinutes,
          })}
        </Text>
        <Text style={[s.rowSkills, { color: c.textMuted }]} numberOfLines={1}>
          {subject.skills.join(' · ')}
        </Text>
      </View>
      <Text style={[s.chevron, { color: c.textMuted }]}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },

  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  progressText: { fontSize: font.sm, fontWeight: '700' },
  progressLink: { fontSize: font.xs, fontWeight: '800' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: space.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  chipText: { fontSize: font.xs, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: font.sm + 1, fontWeight: '800' },
  rowMeta: { fontSize: font.xs, marginTop: 2 },
  rowSkills: { fontSize: font.xs - 1, marginTop: 3 },
  chevron: { fontSize: 22, fontWeight: '700' },
});
