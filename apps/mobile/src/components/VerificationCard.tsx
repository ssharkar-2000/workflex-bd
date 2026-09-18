import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { VerificationLevel, type AuthUser } from '@workflex/shared';
import { fetchOnboardingStatus } from '../api/onboarding';
import { useT, type TranslationKey } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

const STEPS = [
  {
    level: VerificationLevel.L0_PHONE,
    label: 'home.step.phone',
    proof: 'home.proof.phone',
  },
  {
    level: VerificationLevel.L1_IDENTITY,
    label: 'home.step.identity',
    proof: 'home.proof.identity',
  },
  {
    level: VerificationLevel.L2_BUSINESS,
    label: 'home.step.business',
    proof: 'home.proof.business',
  },
] as const satisfies readonly {
  level: number;
  label: TranslationKey;
  proof: TranslationKey;
}[];

export function VerificationCard({
  level,
}: {
  level: AuthUser['verificationLevel'];
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const next = STEPS.find((s) => s.level > level);

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
  });

  /**
   * Registration no longer forces the document step, so an account can sit at
   * level 0 with nothing submitted — this is the way back to it. Once an
   * application is in review there is nothing to do here, and KycStatusCard
   * is already saying so, hence the `!submitted` check.
   */
  const canStartKyc =
    status !== undefined &&
    !status.submitted &&
    next?.level === VerificationLevel.L1_IDENTITY;

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.cardHeadRow}>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {t('home.verification')}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder },
          ]}
        >
          <Text style={[styles.badgeText, { color: c.primary }]}>
            {t('home.level', { level })}
          </Text>
        </View>
      </View>

      <View style={styles.stepRow}>
        {STEPS.map((step, i) => {
          const done = level >= step.level;
          return (
            <View key={step.label} style={styles.step}>
              <View style={styles.stepTop}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: c.bg, borderColor: c.border },
                    done && { backgroundColor: c.primary, borderColor: c.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.dotText,
                      { color: done ? c.primaryText : c.textMuted },
                    ]}
                  >
                    {done ? '✓' : i + 1}
                  </Text>
                </View>
                {i < STEPS.length - 1 ? (
                  <View
                    style={[
                      styles.line,
                      {
                        backgroundColor:
                          level > step.level ? c.primary : c.border,
                      },
                    ]}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: done ? c.text : c.textMuted },
                ]}
              >
                {t(step.label)}
              </Text>
              <Text style={[styles.stepProof, { color: c.textMuted }]}>
                {t(step.proof)}
              </Text>
            </View>
          );
        })}
      </View>

      {next ? (
        <Pressable
          onPress={
            canStartKyc
              ? () => router.push('/(onboarding)/documents')
              : undefined
          }
          disabled={!canStartKyc}
          accessibilityRole={canStartKyc ? 'button' : undefined}
          style={[
            styles.nextBox,
            { backgroundColor: c.warningSoft, borderColor: c.warningBorder },
          ]}
        >
          <Text style={[styles.nextTitle, { color: c.warning }]}>
            {t('home.next.title', { step: t(next.label).toLowerCase() })}
          </Text>
          <Text style={[styles.nextBody, { color: c.text }]}>
            {next.level === VerificationLevel.L1_IDENTITY
              ? t('home.next.identity')
              : t('home.next.business')}
          </Text>
          {canStartKyc ? (
            <View style={[styles.ctaPill, { backgroundColor: c.primary }]}>
              <Text style={[styles.ctaPillText, { color: c.primaryText }]}>
                {t('home.next.start')}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.soonPill,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[styles.soonPillText, { color: c.textMuted }]}>
                {t('common.comingNext')}
              </Text>
            </View>
          )}
        </Pressable>
      ) : (
        <Text style={[styles.nextBody, { color: c.text }]}>
          {t('home.fullyVerified')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.md },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  cardTitle: { fontSize: font.md, fontWeight: '700' },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  badgeText: { fontSize: font.xs, fontWeight: '700' },

  stepRow: { flexDirection: 'row', marginBottom: space.md },
  step: { flex: 1 },
  stepTop: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontSize: font.xs, fontWeight: '700' },
  line: { flex: 1, height: 2, marginHorizontal: space.xs },
  stepLabel: { marginTop: space.sm, fontSize: font.sm, fontWeight: '600' },
  stepProof: { fontSize: font.xs },

  nextBox: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  nextTitle: { fontWeight: '700', marginBottom: space.xs, fontSize: font.sm },
  nextBody: { fontSize: font.sm, lineHeight: 21 },

  soonPill: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  soonPillText: { fontSize: font.xs, fontWeight: '600' },

  ctaPill: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  ctaPillText: { fontSize: font.xs, fontWeight: '800' },
});
