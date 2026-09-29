import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import type { LearningTip, QuestionReview, SkillScore } from '@workflex/shared';
import { fetchResult } from '../../../../src/api/mock';
import { ErrorBanner } from '../../../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../../src/i18n';
import { useTheme } from '../../../../src/lib/use-theme';
import { font, radius, space } from '../../../../src/lib/theme';

type Tab = 'OVERVIEW' | 'REVIEW' | 'LEARN';

/**
 * The result: score, what it was made of, every answer explained, and what
 * to practise.
 *
 * The question review is the part worth the person's time, and it is given
 * a tab of its own rather than being buried under the score. A number tells
 * somebody where they stand; the explanation of a question they got wrong is
 * the only thing on this screen that can change it.
 */
export default function MockResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<Tab>('OVERVIEW');

  const result = useQuery({
    queryKey: ['mock-result', id],
    queryFn: () => fetchResult(id),
    enabled: Boolean(id),
  });

  const data = result.data;

  return (
    <MoneyScreen title={t('mock.resultTitle')} subtitle={data?.title ?? ''}>
      {result.error ? (
        <ErrorBanner message={errorMessage(result.error)} tone="onSurface" />
      ) : null}

      {result.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : !data ? null : (
        <>
          <View style={s.hero}>
            <Ring pct={data.pct} label={`${data.score}/${data.total}`} />
            <Text style={[s.verdict, { color: data.passed ? c.success : c.warning }]}>
              {data.passed ? t('mock.passed') : t('mock.notYet')}
            </Text>
            <Text style={[s.verdictSub, { color: c.textMuted }]}>
              {t('mock.youScored', { pct: data.pct })}
            </Text>
          </View>

          <View style={[s.facts, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Fact label={t('mock.timeTaken')} value={mmss(data.secondsTaken)} />
            <Fact label={t('mock.correct')} value={`${data.score} / ${data.total}`} />
            <Fact label={t('mock.passMark')} value={`${data.passMark}%`} />
          </View>

          <View style={s.tabs}>
            {(['OVERVIEW', 'REVIEW', 'LEARN'] as Tab[]).map((one) => (
              <Pressable
                key={one}
                onPress={() => setTab(one)}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === one }}
                style={[
                  s.tab,
                  tab === one && { borderBottomColor: c.primary, borderBottomWidth: 2 },
                ]}
              >
                <Text style={[s.tabText, { color: tab === one ? c.primary : c.textMuted }]}>
                  {t(`mock.tab.${one}` as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'OVERVIEW' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.breakdown')}</Text>
              {data.breakdown.map((row) => (
                <SkillRow key={row.skill} row={row} />
              ))}
              <Notice tone="info" title={t('mock.insight')} body={data.insight} />
            </>
          ) : null}

          {tab === 'REVIEW' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.review')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('mock.reviewNote')}</Text>
              {data.review.map((q, i) => (
                <ReviewCard key={i} n={i + 1} q={q} />
              ))}
            </>
          ) : null}

          {tab === 'LEARN' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.focus')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('mock.focusNote')}</Text>
              {data.tips.length === 0 ? (
                <Notice tone="success" body={t('mock.noGaps')} />
              ) : (
                data.tips.map((tip) => <TipCard key={tip.skill} tip={tip} />)
              )}
              <Pressable
                onPress={() => router.push('/(app)/learning')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.wide,
                  { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : c.primary },
                ]}
              >
                <Text style={[s.wideText, { color: '#FFFFFF' }]}>{t('mock.explore')}</Text>
              </Pressable>
            </>
          ) : null}

          <View style={s.bottom}>
            <Pressable
              onPress={() => router.replace({ pathname: '/(app)/mock' })}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.wide,
                { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
              ]}
            >
              <Text style={[s.wideText, { color: c.primary }]}>{t('mock.retake')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </MoneyScreen>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const { c } = useTheme();
  const size = 132;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const tone = pct >= 70 ? c.success : pct >= 50 ? c.warning : c.danger;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={s.ringCentre}>
        <Text style={[s.ringText, { color: tone }]}>{label}</Text>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.fact}>
      <Text style={[s.factValue, { color: c.text }]}>{value}</Text>
      <Text style={[s.factLabel, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function SkillRow({ row }: { row: SkillScore }) {
  const { c } = useTheme();
  const tone = row.pct >= 80 ? c.success : row.pct >= 60 ? c.warning : c.danger;
  return (
    <View style={s.skill}>
      <View style={s.skillTop}>
        <Text style={[s.skillName, { color: c.text }]} numberOfLines={1}>
          {row.skill}
        </Text>
        <Text style={[s.skillPct, { color: tone }]}>{row.pct}%</Text>
      </View>
      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
        <View style={[s.fill, { backgroundColor: tone, width: `${row.pct}%` }]} />
      </View>
      <Text style={[s.skillCount, { color: c.textMuted }]}>
        {row.correct} / {row.asked}
      </Text>
    </View>
  );
}

function ReviewCard({ n, q }: { n: number; q: QuestionReview }) {
  const t = useT();
  const { c } = useTheme();
  const right = q.chosen === q.correct;

  return (
    <View
      style={[s.reviewCard, { backgroundColor: c.surface, borderColor: right ? c.success : c.danger }]}
    >
      <View style={s.reviewTop}>
        <Text style={[s.reviewN, { color: c.textMuted }]}>{n}</Text>
        <Text style={[s.reviewPrompt, { color: c.text }]}>{q.prompt}</Text>
      </View>

      {q.options.map((option, i) => {
        const isCorrect = i === q.correct;
        const isChosen = i === q.chosen;
        return (
          <View
            key={i}
            style={[
              s.reviewOption,
              isCorrect && { backgroundColor: c.successSoft },
              isChosen && !isCorrect && { backgroundColor: c.dangerSoft },
            ]}
          >
            <Text
              style={[
                s.reviewOptionText,
                { color: isCorrect ? c.success : isChosen ? c.danger : c.textMuted },
              ]}
            >
              {option}
              {isCorrect ? `  ${t('mock.correctMark')}` : ''}
              {isChosen && !isCorrect ? `  ${t('mock.yours')}` : ''}
            </Text>
          </View>
        );
      })}

      {q.chosen === null ? (
        <Text style={[s.reviewSkipped, { color: c.textMuted }]}>{t('mock.skipped')}</Text>
      ) : null}
      <Text style={[s.reviewWhy, { color: c.text }]}>{q.why}</Text>
    </View>
  );
}

function TipCard({ tip }: { tip: LearningTip }) {
  const t = useT();
  const { c } = useTheme();
  const tone =
    tip.priority === 'HIGH' ? c.danger : tip.priority === 'MEDIUM' ? c.warning : c.textMuted;

  return (
    <View style={[s.tip, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.tipTop}>
        <Text style={[s.tipSkill, { color: c.text }]}>{tip.skill}</Text>
        <View style={[s.priority, { borderColor: tone }]}>
          <Text style={[s.priorityText, { color: tone }]}>
            {t(`mock.priority.${tip.priority}` as TranslationKey)}
          </Text>
        </View>
      </View>
      <Text style={[s.tipMove, { color: c.textMuted }]}>
        {t('mock.currentTarget', { current: tip.current, target: tip.target })} · {tip.effort}
      </Text>
      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
        <View style={[s.fill, { backgroundColor: tone, width: `${tip.current}%` }]} />
      </View>
      <Text style={[s.tipDetail, { color: c.text }]}>{tip.detail}</Text>
    </View>
  );
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}m ${String(seconds % 60).padStart(2, '0')}s`;
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },

  hero: { alignItems: 'center', marginTop: space.md },
  ringCentre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: font.xl, fontWeight: '900' },
  verdict: { fontSize: font.lg, fontWeight: '900', marginTop: space.sm },
  verdictSub: { fontSize: font.sm, marginTop: 2 },

  facts: {
    flexDirection: 'row',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
  },
  fact: { flex: 1 },
  factValue: { fontSize: font.md, fontWeight: '900' },
  factLabel: { fontSize: font.xs - 1, lineHeight: 14, marginTop: 1 },

  tabs: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  tab: { paddingVertical: 8 },
  tabText: { fontSize: font.xs + 1, fontWeight: '800' },

  skill: { marginTop: space.sm },
  skillTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  skillName: { flex: 1, fontSize: font.xs + 1, fontWeight: '700' },
  skillPct: { fontSize: font.sm, fontWeight: '900' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },
  skillCount: { fontSize: font.xs - 1, marginTop: 3 },

  reviewCard: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  reviewTop: { flexDirection: 'row', gap: space.sm },
  reviewN: { fontSize: font.sm, fontWeight: '900', width: 18 },
  reviewPrompt: { flex: 1, fontSize: font.sm, fontWeight: '700', lineHeight: 20 },
  reviewOption: { borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: 7, marginTop: 5 },
  reviewOptionText: { fontSize: font.xs + 1, lineHeight: 17 },
  reviewSkipped: { fontSize: font.xs, fontStyle: 'italic', marginTop: space.xs },
  reviewWhy: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.sm },

  tip: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  tipTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tipSkill: { flex: 1, fontSize: font.sm, fontWeight: '800' },
  priority: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: font.xs - 2, fontWeight: '900' },
  tipMove: { fontSize: font.xs, marginTop: 3 },
  tipDetail: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.xs },

  wide: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: space.md,
  },
  wideText: { fontSize: font.sm, fontWeight: '800' },
  bottom: { marginTop: space.md },
});
