import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import {
  cvAnalysisSchema,
  type CvAnalysis,
  type Insight,
  type SkillMatch,
  type Suggestion,
} from '@workflex/shared';
import { api } from '../../../src/api/client';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

async function fetchAnalysis(): Promise<CvAnalysis> {
  const { data } = await api.get('/cv/analyze', { timeout: 60_000 });
  return cvAnalysisSchema.parse(data);
}

type Tab = 'OVERVIEW' | 'DETAIL' | 'SUGGESTIONS';

/**
 * The AI Resume Analyzer.
 *
 * One number at the top, and then everything it was made of. The number on
 * its own is the least useful thing on the screen — it tells somebody where
 * they stand and nothing about what to do — so the axes, the skills chart
 * and the suggestions all sit under it, and the suggestions are what the
 * screen is really for.
 *
 * The comparison is against open postings in this person's own line of work,
 * not against an imaginary perfect CV. There isn't one: a good CV for an
 * electrician in Dhaka and a good CV for a merchandiser in Chattogram share
 * almost no words.
 */
export default function AnalyzeScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<Tab>('OVERVIEW');

  const analysis = useQuery({
    queryKey: ['cv-analysis'],
    queryFn: fetchAnalysis,
    staleTime: 300_000,
  });

  const data = analysis.data;

  return (
    <MoneyScreen title={t('analyze.title')} subtitle={t('analyze.subtitle')}>
      {analysis.error ? (
        <ErrorBanner message={errorMessage(analysis.error)} tone="onSurface" />
      ) : null}

      {analysis.isLoading ? (
        <>
          <ActivityIndicator color={c.primary} style={s.loading} />
          <Text style={[s.note, { color: c.textMuted }]}>{t('analyze.working')}</Text>
        </>
      ) : !data ? null : (
        <>
          <View style={[s.scoreCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <ScoreRing score={data.score} />
            <View style={s.scoreText}>
              <Text style={[s.scoreTitle, { color: c.text }]}>{t('analyze.overall')}</Text>
              <Text style={[s.verdict, { color: c.textMuted }]}>{data.verdict}</Text>
            </View>
          </View>

          {data.thin ? (
            <Notice
              tone="warning"
              body={t('analyze.thin', { n: data.postingsCompared })}
            />
          ) : null}

          <View style={s.tabs}>
            {(['OVERVIEW', 'DETAIL', 'SUGGESTIONS'] as Tab[]).map((one) => (
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
                <Text
                  style={[
                    s.tabText,
                    { color: tab === one ? c.primary : c.textMuted },
                  ]}
                >
                  {t(`analyze.tab.${one}` as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'OVERVIEW' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('analyze.insights')}</Text>
              <View style={s.insights}>
                {data.insights.map((insight) => (
                  <InsightCard key={insight.key} insight={insight} />
                ))}
              </View>

              <Text style={[s.heading, { color: c.text }]}>{t('analyze.skillsMatch')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>
                {t('analyze.skillsNote', { n: data.postingsCompared })}
              </Text>
              {data.skills.map((skill) => (
                <SkillBar key={skill.skill} skill={skill} />
              ))}
            </>
          ) : null}

          {tab === 'DETAIL' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('analyze.axes')}</Text>
              {data.axes.map((axis) => (
                <View
                  key={axis.key}
                  style={[s.axis, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <View style={s.axisTop}>
                    <Text style={[s.axisName, { color: c.text }]}>
                      {t(`analyze.axis.${axis.key}` as TranslationKey)}
                    </Text>
                    <Text style={[s.axisScore, { color: scoreColour(axis.score, c) }]}>
                      {axis.score}
                    </Text>
                  </View>
                  <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                    <View
                      style={[
                        s.fill,
                        { backgroundColor: scoreColour(axis.score, c), width: `${axis.score}%` },
                      ]}
                    />
                  </View>
                  <Text style={[s.axisDetail, { color: c.textMuted }]}>{axis.detail}</Text>
                  <Text style={[s.axisWeight, { color: c.textMuted }]}>
                    {t('analyze.weight', { n: axis.weight })}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          {tab === 'SUGGESTIONS' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('analyze.improve')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('analyze.improveNote')}</Text>
              {data.suggestions.map((one) => (
                <SuggestionCard
                  key={one.id}
                  suggestion={one}
                  onApply={() => router.push('/(app)/resume/build')}
                />
              ))}
            </>
          ) : null}

          <Text style={[s.note, { color: c.textMuted }]}>{t('analyze.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

/**
 * The ring.
 *
 * Drawn with a stroke-dashoffset rather than an arc path: one circle, one
 * number, and no trigonometry to get wrong at the 100% boundary.
 */
function ScoreRing({ score }: { score: number }) {
  const { c } = useTheme();
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const tone = scoreColour(score, c);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - score / 100)}
          // Start at twelve o'clock rather than three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={s.ringCentre}>
        <Text style={[s.ringText, { color: tone }]}>{score}%</Text>
      </View>
    </View>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { c } = useTheme();
  const tone = insight.good ? c.success : c.warning;
  return (
    <View style={[s.insight, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[s.insightDot, { backgroundColor: tone }]} />
      <Text style={[s.insightTitle, { color: c.text }]} numberOfLines={1}>
        {insight.title}
      </Text>
      <Text style={[s.insightDetail, { color: c.textMuted }]}>{insight.detail}</Text>
    </View>
  );
}

function SkillBar({ skill }: { skill: SkillMatch }) {
  const t = useT();
  const { c } = useTheme();
  // On the CV and in demand is the good case; in demand and missing is the
  // one worth acting on, so it is the one that is coloured differently.
  const tone = skill.onCv ? c.primary : c.warning;

  return (
    <View style={s.skillRow}>
      <Text style={[s.skillName, { color: c.text }]} numberOfLines={1}>
        {skill.skill}
      </Text>
      <View style={[s.skillTrack, { backgroundColor: c.surfaceAlt }]}>
        <View
          style={[s.fill, { backgroundColor: tone, width: `${Math.max(skill.demand, 2)}%` }]}
        />
      </View>
      <Text style={[s.skillPct, { color: c.textMuted }]}>
        {skill.demand}%{skill.onCv ? '' : ` · ${t('analyze.notOnCv')}`}
      </Text>
    </View>
  );
}

function SuggestionCard({
  suggestion,
  onApply,
}: {
  suggestion: Suggestion;
  onApply: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const tone =
    suggestion.priority === 'HIGH'
      ? c.danger
      : suggestion.priority === 'MEDIUM'
        ? c.warning
        : c.textMuted;

  return (
    <View style={[s.suggestion, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.suggestionTop}>
        <Text style={[s.suggestionTitle, { color: c.text }]}>{suggestion.title}</Text>
        <View style={[s.priority, { borderColor: tone }]}>
          <Text style={[s.priorityText, { color: tone }]}>
            {t(`analyze.priority.${suggestion.priority}` as TranslationKey)}
          </Text>
        </View>
      </View>
      <Text style={[s.suggestionDetail, { color: c.textMuted }]}>{suggestion.detail}</Text>
      <Pressable
        onPress={onApply}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.apply,
          { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
        ]}
      >
        <Text style={[s.applyText, { color: c.primary }]}>{t('analyze.fixIt')}</Text>
      </Pressable>
    </View>
  );
}

function scoreColour(score: number, c: { success: string; warning: string; danger: string }) {
  return score >= 75 ? c.success : score >= 45 ? c.warning : c.danger;
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },

  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  scoreText: { flex: 1 },
  scoreTitle: { fontSize: font.sm + 1, fontWeight: '800' },
  verdict: { fontSize: font.xs + 1, lineHeight: 18, marginTop: 3 },
  ringCentre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: font.lg, fontWeight: '900' },

  tabs: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  tab: { paddingVertical: 8, paddingHorizontal: 2 },
  tabText: { fontSize: font.xs + 1, fontWeight: '800' },

  insights: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  insight: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
  },
  insightDot: { width: 9, height: 9, borderRadius: 5, marginBottom: 6 },
  insightTitle: { fontSize: font.xs + 1, fontWeight: '800' },
  insightDetail: { fontSize: font.xs - 1, lineHeight: 15, marginTop: 3 },

  skillRow: { marginBottom: space.sm },
  skillName: { fontSize: font.xs + 1, fontWeight: '700' },
  skillTrack: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },
  skillPct: { fontSize: font.xs - 1, marginTop: 3 },

  axis: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm },
  axisTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  axisName: { fontSize: font.sm, fontWeight: '800' },
  axisScore: { fontSize: font.md, fontWeight: '900' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  axisDetail: { fontSize: font.xs + 1, lineHeight: 17, marginTop: space.xs },
  axisWeight: { fontSize: font.xs - 1, marginTop: 3 },

  suggestion: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  suggestionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  suggestionTitle: { flex: 1, fontSize: font.sm, fontWeight: '800' },
  priority: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: font.xs - 2, fontWeight: '900', letterSpacing: 0.3 },
  suggestionDetail: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.xs },
  apply: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    marginTop: space.sm,
  },
  applyText: { fontSize: font.xs, fontWeight: '800' },
});
