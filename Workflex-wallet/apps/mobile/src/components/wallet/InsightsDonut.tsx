import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatTaka, type WalletEntry } from '@workflex/shared';
import { useT, type Translate } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Slice = { key: string; label: string; total: number; color: string };

/**
 * Where the money went, as a ring.
 *
 * Drawn from the statement rows already on screen, so it answers "what has
 * moved through this wallet lately" rather than claiming to be a lifetime
 * total — the caption says so, because a chart that quietly means something
 * narrower than it looks is worse than no chart.
 *
 * Each slice is one kind of movement, in a hue that kind already owns
 * elsewhere in the app. The four stay apart from each other in both modes:
 * indigo and purple both read as lavender in dark, so a withdrawal takes
 * amber here rather than the purple it wears on a badge.
 */
export function InsightsDonut({ entries }: { entries: WalletEntry[] }) {
  const t = useT();
  const { c } = useTheme();

  const slices = useMemo(() => buildSlices(entries, t, c.success, c.accent, c.primary, c.warning), [
    entries,
    t,
    c.success,
    c.accent,
    c.primary,
    c.warning,
  ]);
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);

  if (!total) return null;

  // Each arc is drawn as a dashed circle whose dash is its own share, then
  // rotated past everything before it.
  let sweptSoFar = 0;

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.title, { color: c.text }]}>{t('wallet.insights.title')}</Text>

      <View style={s.chartRow}>
        <View style={s.chart}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={c.surfaceAlt}
              strokeWidth={STROKE}
              fill="none"
            />
            {slices.map((slice) => {
              const share = slice.total / total;
              const arc = (
                <Circle
                  key={slice.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  stroke={slice.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeLinecap="butt"
                  fill="none"
                  // -90 puts the first slice at twelve o'clock.
                  transform={`rotate(${sweptSoFar * 360 - 90} ${SIZE / 2} ${SIZE / 2})`}
                />
              );
              sweptSoFar += share;
              return arc;
            })}
          </Svg>

          <View style={s.centre} pointerEvents="none">
            <Text style={[s.centreLabel, { color: c.textMuted }]}>
              {t('wallet.insights.moved')}
            </Text>
            <Text style={[s.centreValue, { color: c.text }]} numberOfLines={1}>
              {formatTaka(total)}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: slice.color }]} />
            <Text style={[s.legendLabel, { color: c.textMuted }]} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={[s.legendValue, { color: c.text }]}>{formatTaka(slice.total)}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.caption, { color: c.textMuted }]}>
        {t('wallet.insights.caption', { count: String(entries.length) })}
      </Text>
    </View>
  );
}

/** One slice per kind of movement, biggest first, zero-value kinds dropped. */
function buildSlices(
  entries: WalletEntry[],
  t: Translate,
  inColour: string,
  outColour: string,
  topUpColour: string,
  withdrawColour: string,
): Slice[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const amount = Math.abs(entry.amount);
    if (!amount) continue;
    totals.set(entry.type, (totals.get(entry.type) ?? 0) + amount);
  }

  const colours: Record<string, string> = {
    PAYMENT_RECEIVED: inColour,
    PAYMENT_SENT: outColour,
    TOP_UP: topUpColour,
    WITHDRAWAL: withdrawColour,
    WITHDRAWAL_RETURNED: withdrawColour,
  };
  const labels: Record<string, string> = {
    PAYMENT_RECEIVED: t('wallet.insights.received'),
    PAYMENT_SENT: t('wallet.insights.sent'),
    TOP_UP: t('wallet.insights.toppedUp'),
    WITHDRAWAL: t('wallet.insights.withdrawn'),
    WITHDRAWAL_RETURNED: t('wallet.insights.returned'),
  };

  return [...totals]
    .map(([key, total]) => ({
      key,
      total,
      label: labels[key] ?? key,
      color: colours[key] ?? outColour,
    }))
    .sort((a, b) => b.total - a.total);
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: space.sm },
  title: { fontSize: font.md, fontWeight: '700' },
  chartRow: { alignItems: 'center' },
  chart: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', alignItems: 'center', paddingHorizontal: space.sm },
  centreLabel: { fontSize: 11 },
  centreValue: { fontSize: font.lg, fontWeight: '700' },
  legend: { gap: space.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  legendLabel: { flex: 1, fontSize: font.sm },
  legendValue: { fontSize: font.sm, fontWeight: '600' },
  caption: { fontSize: 11 },
});
