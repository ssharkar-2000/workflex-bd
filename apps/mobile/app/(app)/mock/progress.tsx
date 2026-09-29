import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchProgress } from '../../../src/api/mock';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

type Tab = 'TESTS' | 'GROWTH' | 'GOALS';

/**
 * Progress: what was taken, what improved, and what to aim at next.
 *
 * "Improved" counts skills whose most recent score beats the first one on
 * record — the person's own history against itself, not against anybody
 * else's. It is the one number on this screen that says something got
 * better, and it is the reason to come back.
 */
export default function MockProgressScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<Tab>('TESTS');

  const progress = useQuery({ queryKey: ['mock-progress'], queryFn: fetchProgress });
  const data = progress.data;

  return (
    <MoneyScreen title={t('mock.progressTitle')} subtitle={t('mock.progressSub')}>
      {progress.error ? (
        <ErrorBanner message={errorMessage(progress.error)} tone="onSurface" />
      ) : null}

      {progress.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : !data ? null : data.taken === 0 ? (
        <Notice tone="info" title={t('mock.noneTitle')} body={t('mock.noneBody')} />
      ) : (
        <>
          <View style={s.stats}>
            <Stat value={String(data.taken)} label={t('mock.statTaken')} />
            <Stat value={`${data.averagePct}%`} label={t('mock.statAverage')} />
            <Stat value={String(data.improved)} label={t('mock.statImproved')} />
          </View>

          <View style={s.tabs}>
            {(['TESTS', 'GROWTH', 'GOALS'] as Tab[]).map((one) => (
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
                  {t(`mock.ptab.${one}` as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'TESTS' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.recent')}</Text>
              {data.recent.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() =>
                    router.push({ pathname: '/(app)/mock/result/[id]', params: { id: row.id } })
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    s.row,
                    {
                      backgroundColor: pressed ? c.surfaceAlt : c.surface,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <View style={s.rowBody}>
                    <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text style={[s.rowMeta, { color: c.textMuted }]}>
                      {new Date(row.takenAt).toLocaleDateString()} ·{' '}
                      {t('mock.mins', { n: row.minutes })}
                    </Text>
                  </View>
                  <Text
                    style={[s.rowPct, { color: row.passed ? c.success : c.warning }]}
                  >
                    {row.pct}%
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {tab === 'GROWTH' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.growth')}</Text>
              <Text style={[s.note, { color: c.textMuted }]}>{t('mock.growthNote')}</Text>
              {data.growth.length === 0 ? (
                <Notice tone="info" body={t('mock.growthEmpty')} />
              ) : (
                data.growth.map((row) => {
                  const up = row.latest - row.first;
                  const tone = up > 0 ? c.success : up < 0 ? c.danger : c.textMuted;
                  return (
                    <View key={row.skill} style={s.growth}>
                      <View style={s.growthTop}>
                        <Text style={[s.growthName, { color: c.text }]} numberOfLines={1}>
                          {row.skill}
                        </Text>
                        <Text style={[s.growthMove, { color: tone }]}>
                          {row.first}% → {row.latest}%
                        </Text>
                      </View>
                      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                        <View
                          style={[s.fill, { backgroundColor: tone, width: `${row.latest}%` }]}
                        />
                      </View>
                      <Text style={[s.growthCount, { color: c.textMuted }]}>
                        {t('mock.overTests', { n: row.tests })}
                      </Text>
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          {tab === 'GOALS' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('mock.nextGoal')}</Text>
              <View style={[s.goal, { backgroundColor: c.surface, borderColor: c.primary }]}>
                <Text style={[s.goalLabel, { color: c.text }]}>{data.goal.label}</Text>
                <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                  <View
                    style={[
                      s.fill,
                      {
                        backgroundColor: c.primary,
                        width: `${Math.min(100, Math.round((data.goal.current / Math.max(data.goal.target, 1)) * 100))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[s.goalMeta, { color: c.textMuted }]}>
                  {t('mock.goalAt', { current: data.goal.current, target: data.goal.target })}
                </Text>
              </View>
              <Text style={[s.note, { color: c.textMuted }]}>{t('mock.goalNote')}</Text>
            </>
          ) : null}
        </>
      )}
    </MoneyScreen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.statValue, { color: c.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: 2, marginBottom: space.sm },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },

  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: space.md, alignItems: 'center' },
  statValue: { fontSize: font.lg, fontWeight: '900' },
  statLabel: { fontSize: font.xs - 1, lineHeight: 14, textAlign: 'center', marginTop: 2 },

  tabs: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  tab: { paddingVertical: 8 },
  tabText: { fontSize: font.xs + 1, fontWeight: '800' },

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
  rowTitle: { fontSize: font.sm, fontWeight: '800' },
  rowMeta: { fontSize: font.xs, marginTop: 2 },
  rowPct: { fontSize: font.md, fontWeight: '900' },

  growth: { marginBottom: space.md },
  growthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  growthName: { flex: 1, fontSize: font.xs + 1, fontWeight: '700' },
  growthMove: { fontSize: font.xs + 1, fontWeight: '800' },
  growthCount: { fontSize: font.xs - 1, marginTop: 3 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },

  goal: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginTop: space.xs },
  goalLabel: { fontSize: font.sm + 1, fontWeight: '800', marginBottom: space.xs },
  goalMeta: { fontSize: font.xs, marginTop: 5 },
});
