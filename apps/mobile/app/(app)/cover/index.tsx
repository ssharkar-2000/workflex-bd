import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatTaka, type CoverGap } from '@workflex/shared';
import { fetchGaps } from '../../../src/api/cover';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

/**
 * The Replacement Matcher, first screen: the gaps.
 *
 * Every cancelled shift on this account's postings that nobody is covering,
 * soonest first. The ordering is the whole point — a shift starting in six
 * hours and one starting in three weeks are not the same problem, and the
 * screen should not make the employer work out which is which.
 */
export default function CoverGapsScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const gaps = useQuery({ queryKey: ['cover', 'gaps'], queryFn: fetchGaps });
  const rows = gaps.data?.gaps ?? [];
  const open = rows.filter((gap) => !gap.covered);
  const filled = rows.filter((gap) => gap.covered);

  return (
    <MoneyScreen title={t('cover.title')} subtitle={t('cover.subtitle')}>
      {gaps.error ? <ErrorBanner message={errorMessage(gaps.error)} tone="onSurface" /> : null}

      {gaps.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : rows.length === 0 ? (
        <Notice tone="success" title={t('cover.noneTitle')} body={t('cover.noneBody')} />
      ) : (
        <>
          {open.length === 0 ? (
            <Notice tone="success" title={t('cover.allCovered')} />
          ) : (
            open.map((gap) => (
              <GapCard
                key={gap.shiftId}
                gap={gap}
                onPress={() =>
                  router.push({ pathname: '/(app)/cover/[id]', params: { id: gap.shiftId } })
                }
              />
            ))
          )}

          {filled.length > 0 ? (
            <>
              <Text style={[s.heading, { color: c.text }]}>{t('cover.filled')}</Text>
              {filled.map((gap) => (
                <GapCard key={gap.shiftId} gap={gap} />
              ))}
            </>
          ) : null}
        </>
      )}

      <Text style={[s.note, { color: c.textMuted }]}>{t('cover.footnote')}</Text>
    </MoneyScreen>
  );
}

function GapCard({ gap, onPress }: { gap: CoverGap; onPress?: () => void }) {
  const t = useT();
  const { c } = useTheme();

  /**
   * Three bands rather than a countdown: the employer needs to know whether
   * this is tonight's problem or next week's, and a live-ticking number would
   * be precision about something nobody acts on to the minute.
   */
  const urgency = gap.covered
    ? { tone: c.textMuted, label: t('cover.covered') }
    : gap.hoursUntil < 0
      ? { tone: c.danger, label: t('cover.started') }
      : gap.hoursUntil < 24
        ? { tone: c.danger, label: t('cover.hours', { n: Math.max(1, Math.round(gap.hoursUntil)) }) }
        : { tone: c.textMuted, label: t('cover.days', { n: Math.round(gap.hoursUntil / 24) }) };

  const when = new Date(gap.startsAt);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: pressed && onPress ? c.surfaceAlt : c.surface,
          borderColor: gap.covered ? c.border : urgency.tone,
          opacity: gap.covered ? 0.7 : 1,
        },
      ]}
    >
      <View style={s.cardTop}>
        <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>
          {gap.jobTitle}
        </Text>
        <Text style={[s.urgency, { color: urgency.tone }]}>{urgency.label}</Text>
      </View>

      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
        {when.toLocaleString()} · {gap.location}
      </Text>
      <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>
        {t('cover.cancelledBy', { name: gap.workerName })} · {formatTaka(Math.round(gap.pay / 100))}
      </Text>

      {gap.cancelReason ? (
        <Text style={[s.reason, { color: c.text }]} numberOfLines={2}>
          “{gap.cancelReason}”
        </Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.md },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, fontSize: font.sm + 1, fontWeight: '800' },
  urgency: { fontSize: font.xs, fontWeight: '800' },
  meta: { fontSize: font.xs, marginTop: 3 },
  reason: { fontSize: font.xs + 1, fontStyle: 'italic', marginTop: space.xs },
});
