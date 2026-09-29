import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MockTest } from '@workflex/shared';
import { fetchSubjects, startTest, submitTest } from '../../../src/api/mock';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

const CHECKS = ['net', 'autoSubmit', 'noBack', 'feedback'] as const;

/**
 * Instructions, then the test itself.
 *
 * One screen with two phases rather than two routes, because the clock
 * starts when the questions are generated. Navigating between routes with a
 * running timer means a back gesture can strand somebody mid-test with time
 * ticking and no way to submit — the worst possible failure for a thing
 * people take on a bus with a bad connection.
 */
export default function MockTestScreen() {
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [test, setTest] = useState<MockTest | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [at, setAt] = useState(0);
  const [left, setLeft] = useState(0);

  const subjects = useQuery({ queryKey: ['mock-subjects'], queryFn: fetchSubjects });
  const info = subjects.data?.subjects.find((one) => one.key === subject);

  const begin = useMutation({
    mutationFn: () => startTest(subject),
    onSuccess: (generated) => {
      setTest(generated);
      setAnswers(new Array(generated.questions.length).fill(null));
      setAt(0);
      setLeft(generated.durationSeconds);
    },
  });

  const finish = useMutation({
    mutationFn: (given: (number | null)[]) => submitTest(test!.id, given),
    onSuccess: (result) => {
      queryClient.setQueryData(['mock-result', result.id], result);
      void queryClient.invalidateQueries({ queryKey: ['mock-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['mock-subjects'] });
      router.replace({ pathname: '/(app)/mock/result/[id]', params: { id: result.id } });
    },
  });

  /**
   * The clock.
   *
   * Submitting on its own when time runs out, which is what the instructions
   * promise. A test that simply freezes at zero loses the work somebody has
   * already done, and they would have no way to get the marks they earned.
   */
  const submitted = useRef(false);
  useEffect(() => {
    if (!test || left <= 0) return;
    const id = setInterval(() => setLeft((was) => Math.max(0, was - 1)), 1000);
    return () => clearInterval(id);
  }, [test, left]);

  useEffect(() => {
    if (test && left === 0 && !submitted.current && !finish.isPending) {
      submitted.current = true;
      finish.mutate(answers);
    }
  }, [test, left, answers, finish]);

  // --- before it starts ---
  if (!test) {
    return (
      <MoneyScreen title={t('mock.title')} subtitle={info?.title ?? ''}>
        {begin.error ? (
          <ErrorBanner message={errorMessage(begin.error)} tone="onSurface" />
        ) : null}

        {info ? (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[s.cardTitle, { color: c.text }]}>{info.title}</Text>
            <Text style={[s.cardMeta, { color: c.textMuted }]}>
              {t('mock.level.INTERMEDIATE')} · {t('mock.qCount', { n: 10 })} ·{' '}
              {t('mock.mins', { n: 15 })}
            </Text>
            <Text style={[s.cardSkills, { color: c.textMuted }]}>
              {info.skills.join(' · ')}
            </Text>
          </View>
        ) : null}

        <Text style={[s.heading, { color: c.text }]}>{t('mock.before')}</Text>
        {CHECKS.map((key) => (
          <View key={key} style={s.check}>
            <View style={[s.checkDot, { backgroundColor: c.success }]} />
            <Text style={[s.checkText, { color: c.text }]}>
              {t(`mock.check.${key}` as TranslationKey)}
            </Text>
          </View>
        ))}

        <Notice tone="info" title={t('mock.goodLuck')} body={t('mock.goodLuckBody')} />

        <View style={s.action}>
          <ShimmerButton
            label={t('mock.start')}
            onPress={() => begin.mutate()}
            loading={begin.isPending}
          />
        </View>
        {begin.isPending ? (
          <Text style={[s.note, { color: c.textMuted }]}>{t('mock.writing')}</Text>
        ) : null}
      </MoneyScreen>
    );
  }

  // --- taking it ---
  const question = test.questions[at]!;
  const answered = answers.filter((one) => one !== null).length;
  const last = at === test.questions.length - 1;

  const choose = (index: number) =>
    setAnswers((was) => was.map((one, i) => (i === at ? index : one)));

  const onFinish = () => {
    const missing = test.questions.length - answered;
    if (missing > 0) {
      Alert.alert(t('mock.unansweredTitle'), t('mock.unansweredBody', { n: missing }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('mock.submitAnyway'), onPress: () => finish.mutate(answers) },
      ]);
      return;
    }
    finish.mutate(answers);
  };

  return (
    <MoneyScreen title={test.title} subtitle={t('mock.qOf', { at: at + 1, of: test.questions.length })}>
      <View style={s.topRow}>
        <View style={[s.bar, { backgroundColor: c.surfaceAlt }]}>
          <View
            style={[
              s.barFill,
              { backgroundColor: c.primary, width: `${((at + 1) / test.questions.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={[s.clock, { color: left <= 60 ? c.danger : c.text }]}>
          {clock(left)}
        </Text>
      </View>

      {finish.error ? (
        <ErrorBanner message={errorMessage(finish.error)} tone="onSurface" />
      ) : null}

      <Text style={[s.prompt, { color: c.text }]}>{question.prompt}</Text>

      {question.code ? (
        <View style={[s.code, { backgroundColor: c.text }]}>
          <Text style={[s.codeText, { color: c.bg }]}>{question.code}</Text>
        </View>
      ) : null}

      {question.options.map((option, i) => {
        const picked = answers[at] === i;
        return (
          <Pressable
            key={i}
            onPress={() => choose(i)}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked }}
            style={({ pressed }) => [
              s.option,
              {
                borderColor: picked ? c.primary : c.border,
                backgroundColor: picked ? c.primarySoft : pressed ? c.surfaceAlt : c.surface,
              },
            ]}
          >
            <View
              style={[
                s.radio,
                { borderColor: picked ? c.primary : c.border },
                picked && { backgroundColor: c.primary },
              ]}
            />
            <Text style={[s.optionText, { color: c.text }]}>{option}</Text>
          </Pressable>
        );
      })}

      <View style={s.nav}>
        <Pressable
          onPress={() => setAt((was) => Math.max(0, was - 1))}
          disabled={at === 0}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.navButton,
            {
              borderColor: c.border,
              backgroundColor: pressed ? c.surfaceAlt : 'transparent',
              opacity: at === 0 ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[s.navText, { color: c.textMuted }]}>{t('mock.previous')}</Text>
        </Pressable>

        <Pressable
          onPress={() => (last ? onFinish() : setAt((was) => was + 1))}
          disabled={finish.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.navButton,
            {
              borderColor: c.primary,
              backgroundColor: c.primary,
              opacity: finish.isPending ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[s.navText, { color: '#FFFFFF' }]}>
            {last ? t('mock.submit') : t('mock.next')}
          </Text>
        </Pressable>
      </View>

      <Text style={[s.note, { color: c.textMuted }]}>
        {t('mock.answered', { n: answered, of: test.questions.length })}
      </Text>
    </MoneyScreen>
  );
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.sm, textAlign: 'center' },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },
  action: { marginTop: space.lg },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  cardTitle: { fontSize: font.md, fontWeight: '900' },
  cardMeta: { fontSize: font.xs, marginTop: 3 },
  cardSkills: { fontSize: font.xs - 1, marginTop: space.xs },

  check: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  checkDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  checkText: { flex: 1, fontSize: font.xs + 1, lineHeight: 18 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  clock: { fontSize: font.sm, fontWeight: '900', minWidth: 52, textAlign: 'right' },

  prompt: { fontSize: font.sm + 2, fontWeight: '700', lineHeight: 22, marginTop: space.lg },
  code: { borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  codeText: { fontFamily: 'monospace', fontSize: font.xs + 1, lineHeight: 19 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  optionText: { flex: 1, fontSize: font.sm, lineHeight: 20 },

  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  navButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navText: { fontSize: font.sm, fontWeight: '800' },
});
