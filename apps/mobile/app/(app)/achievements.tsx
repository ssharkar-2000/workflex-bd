import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { achievementsSchema, type Achievements, type Badge } from '@workflex/shared';
import { api } from '../../src/api/client';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

type Tab = 'ALL' | 'BADGES' | 'STATS';

async function fetchAchievements(): Promise<Achievements> {
  const { data } = await api.get('/users/achievements');
  return achievementsSchema.parse(data);
}

/**
 * Achievements.
 *
 * Every badge here was earned by doing the work — shifts finished, ratings
 * given by people who hired them, tests sat, a credential an institution
 * signed. None is awarded for signing up or filling in a field, because a
 * badge for completing a profile devalues the one for turning up to twenty
 * shifts, and then neither means anything to the employer reading them.
 *
 * Each card carries the number behind it and the date it was earned, so the
 * wall can be read rather than admired.
 */
export default function AchievementsScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<Tab>('ALL');

  const data = useQuery({ queryKey: ['achievements'], queryFn: fetchAchievements });
  const a = data.data;

  return (
    <MoneyScreen title={t('ach.title')} subtitle={t('ach.subtitle')}>
      {data.error ? <ErrorBanner message={errorMessage(data.error)} tone="onSurface" /> : null}

      {data.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : !a ? null : (
        <>
          <Notice tone="info" body={t('ach.earnedNote')} />

          <View style={s.tabs}>
            {(['ALL', 'BADGES', 'STATS'] as Tab[]).map((one) => (
              <Pressable
                key={one}
                onPress={() => setTab(one)}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === one }}
                style={({ pressed }) => [
                  s.tab,
                  {
                    backgroundColor:
                      tab === one ? c.primary : pressed ? c.surfaceAlt : 'transparent',
                    borderColor: tab === one ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={[s.tabText, { color: tab === one ? '#FFFFFF' : c.textMuted }]}>
                  {t(`ach.tab.${one}` as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab !== 'STATS' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>
                {t('ach.badges', { n: a.badges.length })}
              </Text>
              {a.badges.length === 0 ? (
                <Notice tone="info" body={t('ach.noneYet')} />
              ) : (
                <View style={s.grid}>
                  {a.badges.map((b) => (
                    <BadgeCard key={b.key} badge={b} />
                  ))}
                </View>
              )}

              {a.locked.length > 0 ? (
                <>
                  <Text style={[s.heading, { color: c.text }]}>{t('ach.next')}</Text>
                  {a.locked.map((one) => (
                    <View
                      key={one.key}
                      style={[s.locked, { backgroundColor: c.surface, borderColor: c.border }]}
                    >
                      <Text style={[s.lockedName, { color: c.text }]}>
                        {t(`ach.badge.${one.key}` as TranslationKey)}
                      </Text>
                      <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                        <View
                          style={[
                            s.fill,
                            {
                              backgroundColor: c.primary,
                              width: `${Math.min(100, Math.round((one.have / one.need) * 100))}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.lockedMeta, { color: c.textMuted }]}>
                        {t('ach.progress', { have: one.have, need: one.need })}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {tab !== 'BADGES' ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('ach.keyStats')}</Text>
              <View style={s.grid}>
                <Stat value={String(a.stats.completedJobs)} label={t('ach.s.jobs')} />
                <Stat
                  value={a.stats.onTimeRate === null ? '—' : `${a.stats.onTimeRate}%`}
                  label={t('ach.s.onTime')}
                />
                <Stat
                  value={a.stats.avgRating === null ? '—' : String(a.stats.avgRating)}
                  label={t('ach.s.rating')}
                />
                <Stat value={String(a.stats.testsTaken)} label={t('ach.s.tests')} />
                <Stat value={String(a.stats.credentials)} label={t('ach.s.creds')} />
              </View>
            </>
          ) : null}

          <Text style={[s.note, { color: c.textMuted }]}>{t('ach.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <View style={[s.badge, { backgroundColor: c.surface, borderColor: c.primary }]}>
      <Text style={[s.badgeName, { color: c.text }]} numberOfLines={2}>
        {t(`ach.badge.${badge.key}` as TranslationKey)}
      </Text>
      <Text style={[s.badgeCount, { color: c.primary }]}>
        {t(`ach.count.${badge.key}` as TranslationKey, { n: badge.count })}
      </Text>
      <Text style={[s.badgeDate, { color: c.textMuted }]}>
        {t('ach.earnedOn', { date: new Date(badge.earnedAt).toLocaleDateString() })}
      </Text>
    </View>
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
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.md },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },

  tabs: { flexDirection: 'row', gap: 7, marginTop: space.sm },
  tab: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7 },
  tabText: { fontSize: font.xs, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
  },
  badgeName: { fontSize: font.xs + 1, fontWeight: '800', lineHeight: 17 },
  badgeCount: { fontSize: font.sm, fontWeight: '900', marginTop: 4 },
  badgeDate: { fontSize: font.xs - 2, marginTop: 3 },

  locked: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm },
  lockedName: { fontSize: font.xs + 1, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 3 },
  lockedMeta: { fontSize: font.xs, marginTop: 4 },

  stat: {
    flexBasis: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    alignItems: 'center',
  },
  statValue: { fontSize: font.lg, fontWeight: '900' },
  statLabel: { fontSize: font.xs - 1, lineHeight: 14, textAlign: 'center', marginTop: 2 },
});
