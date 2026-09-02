import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { TrustBand, TrustFactor, TrustFactorKind } from '@workflex/shared';
import { fetchTrustScore } from '../../api/auth';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/** The row label for each factor. */
const LABELS: Record<TrustFactorKind, TranslationKey> = {
  IDENTITY: 'trust.f.identity',
  PHOTO: 'trust.f.photo',
  EMAIL: 'trust.f.email',
  HIRED: 'trust.f.hired',
  RELIABILITY: 'trust.f.reliability',
  BUSINESS: 'trust.f.business',
};

/** Where an unearned factor is earned, so the CTA is one tap from the cure. */
const ROUTES: Record<TrustFactorKind, string> = {
  IDENTITY: '/(onboarding)/documents',
  PHOTO: '/(onboarding)/documents',
  EMAIL: '/(app)/profile',
  HIRED: '/(app)/jobs',
  RELIABILITY: '/(app)/jobs',
  BUSINESS: '/(onboarding)/documents',
};

const BAND_LABELS: Record<TrustBand, TranslationKey> = {
  EXCELLENT: 'trust.band.excellent',
  STRONG: 'trust.band.strong',
  BUILDING: 'trust.band.building',
  NEW: 'trust.band.new',
};

/**
 * What WorkFlex BD can vouch for about this account.
 *
 * The number is the headline, but the list under it is the point: a score on
 * its own asks to be trusted, whereas a score with its workings shown can be
 * checked. Every row here is a database record — an approved NID, an accepted
 * application, an attendance row — and a factor with nothing behind it says
 * so rather than showing a zero that reads like a failure.
 *
 * There is deliberately no star rating. Nobody can rate anyone on this
 * platform yet, so the figure would have to be invented, and the single line
 * on a trust card that must never be invented is the one people read as
 * "other people vouch for this person".
 */
export function TrustScore() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['trust-score'],
    queryFn: fetchTrustScore,
    staleTime: 120_000,
  });

  if (!data) return null;

  // The first thing worth more than nothing that has not been earned. Ordered
  // by weight in the service, so this is the largest single gain available.
  const next = data.factors
    .filter((f) => !f.earned && f.max > 0)
    .sort((a, b) => b.max - a.max)[0];

  const bandColour =
    data.band === 'EXCELLENT' || data.band === 'STRONG' ? c.primary : c.textMuted;

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={[styles.title, { color: c.text }]}>
          ⭐ {t('trust.title')}
        </Text>

        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: c.text }]}>{data.score}</Text>
          <Text style={[styles.outOf, { color: c.textMuted }]}>/100</Text>
        </View>

        <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
          <View
            style={[
              styles.fill,
              { width: `${data.score}%`, backgroundColor: c.primary },
            ]}
          />
        </View>

        <Text style={[styles.band, { color: bandColour }]}>
          {t(BAND_LABELS[data.band])}
        </Text>

        <View style={styles.factors}>
          {data.factors.map((factor) => (
            <FactorRow key={factor.kind} factor={factor} />
          ))}
        </View>

        {data.upheldReports > 0 ? (
          <Text style={[styles.penalty, { color: c.danger }]}>
            {t('trust.penalty', {
              count: data.upheldReports,
              points: data.penalty,
            })}
          </Text>
        ) : null}

        {next ? (
          <Pressable
            onPress={() => router.push(ROUTES[next.kind] as never)}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.ctaText, { color: c.primaryText }]}>
              {t('trust.improve')} →
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One factor, with its evidence.
 *
 * A tick for earned, a hollow ring for not — never a cross, which reads as a
 * failure when most unearned rows are simply things the person has not got
 * round to. The number on the right is the record itself, so the row can be
 * argued with.
 */
function FactorRow({ factor }: { factor: TrustFactor }) {
  const t = useT();
  const { c } = useTheme();

  const detail = (() => {
    if (factor.kind === 'HIRED') {
      return factor.detail && factor.detail > 0
        ? t('trust.d.hired', { count: factor.detail })
        : t('trust.d.notHired');
    }
    if (factor.kind === 'RELIABILITY') {
      return factor.detail === null
        ? t('trust.d.noShifts')
        : t('trust.d.reliability', { percent: factor.detail });
    }
    return null;
  })();

  return (
    <View style={styles.factorRow}>
      <Text
        style={[
          styles.mark,
          { color: factor.earned ? c.primary : c.textMuted },
        ]}
      >
        {factor.earned ? '✓' : '○'}
      </Text>
      <Text
        style={[
          styles.factorLabel,
          { color: factor.earned ? c.text : c.textMuted },
        ]}
        numberOfLines={1}
      >
        {t(LABELS[factor.kind])}
      </Text>
      {detail ? (
        <Text style={[styles.factorDetail, { color: c.textMuted }]}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16 },

  title: { fontSize: font.lg, fontWeight: '800', letterSpacing: -0.3 },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 14,
  },
  score: { fontSize: font.display, fontWeight: '800', letterSpacing: -1.5 },
  outOf: { fontSize: font.md, fontWeight: '700', marginLeft: 2 },

  track: {
    height: 10,
    borderRadius: radius.pill,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  band: {
    fontSize: font.sm,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },

  factors: { marginTop: 16, gap: 9 },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { fontSize: font.sm, fontWeight: '800', width: 14 },
  factorLabel: { flex: 1, fontSize: font.sm, fontWeight: '700' },
  factorDetail: { fontSize: font.xs, fontWeight: '700' },

  penalty: { fontSize: font.xs, marginTop: 12, lineHeight: 17 },

  cta: {
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 16,
  },
  ctaText: { fontSize: font.sm, fontWeight: '800' },
});
