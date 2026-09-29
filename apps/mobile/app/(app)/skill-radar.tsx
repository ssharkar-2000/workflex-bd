import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  jobCategoryName,
  skillTrendsSchema,
  type SkillTrend,
  type SkillTrends,
  type TrendDirection,
} from '@workflex/shared';
import { api } from '../../src/api/client';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

async function fetchSkillTrends(): Promise<SkillTrends> {
  const { data } = await api.get('/jobs/skill-trends', { timeout: 60_000 });
  return skillTrendsSchema.parse(data);
}

/**
 * The Skill Radar.
 *
 * Which skills the postings on this platform are asking for more of than
 * they were a month ago, and — the part that matters — which of those are in
 * this person's line of work and not yet on their CV. That last list is the
 * bridge to the Learning Lab: a trend somebody cannot act on is decoration.
 *
 * Every number is a count of real postings. The arrows are withheld whenever
 * the two halves of the window are too thin or too lopsided to compare,
 * because somebody may spend a fortnight learning what this screen points
 * at, and a fortnight is a real cost to a person on a daily wage.
 */
export default function SkillRadarScreen() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const radar = useQuery({
    queryKey: ['skill-trends'],
    queryFn: fetchSkillTrends,
    staleTime: 600_000,
  });

  const data = radar.data;

  return (
    <MoneyScreen title={t('radar.title')} subtitle={t('radar.subtitle')}>
      {radar.error ? <ErrorBanner message={errorMessage(radar.error)} tone="onSurface" /> : null}

      {radar.isLoading ? (
        <>
          <ActivityIndicator color={c.primary} style={s.loading} />
          <Text style={[s.note, { color: c.textMuted }]}>{t('radar.working')}</Text>
        </>
      ) : !data ? null : data.trends.length === 0 ? (
        <Notice tone="info" title={t('radar.emptyTitle')} body={data.insight} />
      ) : (
        <>
          <View style={[s.window, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <Half label={t('radar.lastMonth')} value={data.lastMonthJobs} muted />
            <Text style={[s.arrow, { color: c.textMuted }]}>→</Text>
            <Half label={t('radar.thisMonth')} value={data.thisMonthJobs} />
          </View>

          <Notice tone={data.thin ? 'warning' : 'info'} body={data.insight} />

          {/* The list that connects the marketplace to the Learning Lab. */}
          {data.toLearn.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('radar.learnNext')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('radar.learnNextNote')}</Text>
              <View style={s.chips}>
                {data.toLearn.map((trend) => (
                  <Pressable
                    key={trend.skill}
                    onPress={() => router.push('/(app)/learning')}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.chip,
                      {
                        borderColor: c.primary,
                        backgroundColor: pressed ? c.primarySoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[s.chipText, { color: c.primary }]}>{trend.skill}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {data.forYou.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('radar.inYourField')}</Text>
              {data.forYou.map((trend) => (
                <TrendRow key={trend.skill} trend={trend} locale={locale} />
              ))}
            </>
          ) : null}

          <Text style={[s.heading, { color: c.text }]}>{t('radar.everything')}</Text>
          {data.trends.map((trend) => (
            <TrendRow key={trend.skill} trend={trend} locale={locale} />
          ))}

          <Pressable
            onPress={() => router.push('/(app)/learning')}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.toLab,
              { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
            ]}
          >
            <Text style={[s.toLabText, { color: c.primary }]}>{t('radar.openLab')}</Text>
          </Pressable>

          <Text style={[s.note, { color: c.textMuted }]}>{t('radar.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

function Half({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={s.half}>
      <Text style={[s.halfValue, { color: muted ? c.textMuted : c.text }]}>{value}</Text>
      <Text style={[s.halfLabel, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function TrendRow({ trend, locale }: { trend: SkillTrend; locale: 'en' | 'bn' }) {
  const t = useT();
  const { c } = useTheme();

  const tone =
    trend.direction === 'RISING' || trend.direction === 'NEW'
      ? c.success
      : trend.direction === 'FALLING'
        ? c.danger
        : c.textMuted;

  return (
    <View style={[s.row, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.rowTop}>
        <View style={s.rowWho}>
          <Text style={[s.skill, { color: c.text }]} numberOfLines={1}>
            {trend.skill}
          </Text>
          <Text style={[s.category, { color: c.textMuted }]} numberOfLines={1}>
            {jobCategoryName(trend.category, locale)}
            {trend.onYourCv ? ` · ${t('radar.onYourCv')}` : ''}
          </Text>
        </View>
        <Text style={[s.change, { color: tone }]}>{changeLabel(trend, t)}</Text>
      </View>

      {/* Eight weeks, oldest on the left. A month-on-month number can hide a
          single busy week, and the shape says which of the two it is. */}
      <Sparkline weekly={trend.weekly} tone={tone} />

      <Text style={[s.counts, { color: c.textMuted }]}>
        {t('radar.counts', { last: trend.lastMonth, now: trend.thisMonth })}
      </Text>
    </View>
  );
}

function Sparkline({ weekly, tone }: { weekly: number[]; tone: string }) {
  const { c } = useTheme();
  const most = Math.max(...weekly, 1);

  return (
    <View style={s.spark}>
      {weekly.map((count, i) => (
        <View key={i} style={[s.sparkCell, { backgroundColor: c.surfaceAlt }]}>
          <View
            style={[
              s.sparkBar,
              {
                backgroundColor: tone,
                // A zero week still shows a sliver, so an empty bucket is
                // visibly empty rather than indistinguishable from a gap.
                height: `${Math.max(6, Math.round((count / most) * 100))}%`,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/** The arrow and the number, or a plain count when no arrow is earned. */
function changeLabel(trend: SkillTrend, t: (key: never) => string): string {
  const label = {
    NEW: 'radar.new',
    RISING: 'radar.up',
    FALLING: 'radar.down',
    STEADY: 'radar.steady',
  }[trend.direction] as never;

  if (trend.direction === 'STEADY' || trend.changePct === null) return t(label);
  const sign = trend.changePct > 0 ? '+' : '';
  return `${t(label)} ${sign}${trend.changePct}%`;
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.xs },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg },

  window: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  half: { flex: 1 },
  halfValue: { fontSize: font.lg, fontWeight: '900' },
  halfLabel: { fontSize: font.xs - 1, lineHeight: 14 },
  arrow: { fontSize: font.md, fontWeight: '900' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.xs },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  chipText: { fontSize: font.xs, fontWeight: '800' },

  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  rowWho: { flex: 1 },
  skill: { fontSize: font.sm + 1, fontWeight: '800' },
  category: { fontSize: font.xs, marginTop: 1 },
  change: { fontSize: font.xs + 1, fontWeight: '900' },

  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 34, marginTop: space.sm },
  sparkCell: { flex: 1, height: '100%', justifyContent: 'flex-end', borderRadius: 3, overflow: 'hidden' },
  sparkBar: { width: '100%', borderRadius: 3 },

  counts: { fontSize: font.xs, marginTop: 6 },

  toLab: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    marginTop: space.lg,
  },
  toLabText: { fontSize: font.xs, fontWeight: '800' },
});
