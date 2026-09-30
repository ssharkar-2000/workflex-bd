import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RatingsPage, Review, ReviewRole } from '@workflex/shared';
import { fetchRatings } from '../../src/api/reviews';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useT, type TranslationKey } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

const SCORES = ['5', '4', '3', '2', '1'] as const;

/**
 * What people say about this account, on both sides of the platform.
 *
 * Worker and recruiter are separate tabs rather than one blended score: the
 * same person can be excellent to hire and slow to pay, and averaging those
 * into one number hides exactly the thing the other party wants to know.
 */
export default function RatingsScreen() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const [role, setRole] = useState<ReviewRole>('WORKER');

  const page = useQuery<RatingsPage>({
    queryKey: ['ratings', role],
    queryFn: () => fetchRatings(role),
  });

  const summary = page.data?.summary;
  const most = summary?.count
    ? Math.max(...SCORES.map((score) => summary.distribution[score] ?? 0))
    : 0;

  return (
    <MoneyScreen
      title={t('ratings.title')}
      refreshing={page.isRefetching}
      onRefresh={() => void page.refetch()}
    >
      {/* Which side of the platform */}
      <View style={[s.tabs, { backgroundColor: c.surfaceAlt }]}>
        {(['WORKER', 'RECRUITER'] as ReviewRole[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => setRole(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: role === option }}
            style={[s.tab, role === option && { backgroundColor: c.primary }]}
          >
            <Text
              style={[s.tabText, { color: role === option ? c.primaryText : c.textMuted }]}
            >
              {t(`ratings.as.${option}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {page.error ? <ErrorBanner message={errorMessage(page.error)} tone="onSurface" /> : null}

      {page.isLoading || !summary ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (
        <>
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[s.score, { color: c.text }]}>
              {summary.average === null ? '—' : summary.average.toFixed(1)}
              <Text style={[s.outOf, { color: c.textMuted }]}> / 5.0</Text>
            </Text>
            <Stars value={summary.average ?? 0} />
            <Text style={[s.count, { color: c.textMuted }]}>
              {t('ratings.reviews', { count: String(summary.count) })}
            </Text>

            {summary.count > 0 ? (
              <View style={s.bars}>
                {SCORES.map((score) => {
                  const value = summary.distribution[score] ?? 0;
                  return (
                    <View key={score} style={s.barRow}>
                      <Text style={[s.barLabel, { color: c.textMuted }]}>{score} ★</Text>
                      <View style={[s.barTrack, { backgroundColor: c.surfaceAlt }]}>
                        <View
                          style={[
                            s.barFill,
                            {
                              backgroundColor: c.accent,
                              // Against the biggest bar, not the total: with
                              // 21 fives and 1 three, a share-of-total bar for
                              // the three is invisible.
                              width: most ? `${Math.round((value / most) * 100)}%` : '0%',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.barValue, { color: c.text }]}>{value}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Stat
              label={t('ratings.jobsCompleted')}
              value={String(summary.jobsCompleted)}
            />
            <Stat
              label={t('ratings.onTime')}
              value={summary.onTimeRate === null ? '—' : `${summary.onTimeRate}%`}
            />
            <Stat
              label={t(`ratings.again.${role}` as TranslationKey)}
              value={
                summary.wouldWorkAgainRate === null ? '—' : `${summary.wouldWorkAgainRate}%`
              }
            />
          </View>

          {summary.themes.length > 0 ? (
            <View style={[s.card, { backgroundColor: c.aiSoft, borderColor: c.aiSoftBorder }]}>
              <Text style={[s.insightTitle, { color: c.ai }]}>{t('ratings.insights')}</Text>
              <Text style={[s.insightBody, { color: c.text }]}>
                {t('ratings.insightsBody', {
                  themes: summary.themes
                    .map((entry) => t(`ratings.theme.${entry.theme}` as TranslationKey))
                    .join(', '),
                })}
              </Text>
              <Text style={[s.insightNote, { color: c.textMuted }]}>
                {t('ratings.insightsNote')}
              </Text>
            </View>
          ) : null}

          <Text style={[s.section, { color: c.text }]}>{t('ratings.latest')}</Text>
          <ReviewList
            reviews={page.data?.received ?? []}
            empty={t('ratings.noneReceived')}
          />

          <Text style={[s.section, { color: c.text }]}>{t('ratings.given')}</Text>
          <ReviewList reviews={page.data?.given ?? []} empty={t('ratings.noneGiven')} />
        </>
      )}
    </MoneyScreen>
  );
}

function ReviewList({ reviews, empty }: { reviews: Review[]; empty: string }) {
  const t = useT();
  const { c } = useTheme();

  if (reviews.length === 0) {
    return <Text style={[s.empty, { color: c.textMuted }]}>{empty}</Text>;
  }

  return (
    <View style={[s.list, { backgroundColor: c.surface, borderColor: c.border }]}>
      {reviews.map((review, i) => (
        <View
          key={review.id}
          style={[s.review, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
        >
          <View style={s.reviewTop}>
            <Stars value={review.rating} small />
            <Text style={[s.reviewName, { color: c.text }]} numberOfLines={1}>
              {review.counterpart.name}
            </Text>
          </View>
          {review.comment ? (
            <Text style={[s.reviewBody, { color: c.text }]}>“{review.comment}”</Text>
          ) : null}
          <Text style={[s.verified, { color: c.success }]}>
            ✓ {t('ratings.verified', { job: review.job.title })}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Five stars, filled to the nearest whole one. */
function Stars({ value, small }: { value: number; small?: boolean }) {
  const { c } = useTheme();
  const filled = Math.round(value);
  return (
    <Text style={[small ? s.starsSmall : s.stars, { color: c.accent }]}>
      {'★'.repeat(filled)}
      <Text style={{ color: c.border }}>{'★'.repeat(5 - filled)}</Text>
    </Text>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.stat}>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.statValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginTop: space.sm },
  tab: { flex: 1, borderRadius: radius.pill, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: font.sm, fontWeight: '800' },

  loading: { marginTop: space.lg },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
    alignItems: 'center',
  },
  score: { fontSize: font.display, fontWeight: '800', letterSpacing: -1 },
  outOf: { fontSize: font.md, fontWeight: '700' },
  stars: { fontSize: 22, letterSpacing: 2, marginTop: 2 },
  starsSmall: { fontSize: 13, letterSpacing: 1 },
  count: { fontSize: font.sm, marginTop: 2 },

  bars: { alignSelf: 'stretch', marginTop: space.md, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barLabel: { width: 34, fontSize: font.xs, fontWeight: '700' },
  barTrack: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: radius.pill },
  barValue: { width: 26, fontSize: font.xs, fontWeight: '700', textAlign: 'right' },

  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 6,
  },
  statLabel: { fontSize: font.sm },
  statValue: { fontSize: font.md, fontWeight: '800' },

  insightTitle: { alignSelf: 'flex-start', fontSize: font.sm, fontWeight: '800' },
  insightBody: { alignSelf: 'flex-start', fontSize: font.sm, lineHeight: 20, marginTop: 4 },
  insightNote: { alignSelf: 'flex-start', fontSize: 11, marginTop: 6 },

  section: { fontSize: font.lg, fontWeight: '800', marginTop: space.lg, marginBottom: space.sm },
  empty: { fontSize: font.sm, lineHeight: 20 },
  list: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md },
  review: { paddingVertical: space.md, gap: 3 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reviewName: { flex: 1, fontSize: font.sm, fontWeight: '800' },
  reviewBody: { fontSize: font.sm, lineHeight: 20 },
  verified: { fontSize: font.xs, fontWeight: '700' },
});
