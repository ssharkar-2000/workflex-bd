import { StyleSheet, Text, View } from 'react-native';
import type { JobMatch } from '@workflex/shared';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

const LABELS: Record<JobMatch['band'], TranslationKey> = {
  STRONG: 'match.STRONG',
  GOOD: 'match.GOOD',
  FAIR: 'match.FAIR',
  WEAK: 'match.WEAK',
};

/**
 * How well a listing fits the account's parsed CV.
 *
 * Renders nothing when `match` is null — no CV uploaded, or parsing switched
 * off. That is deliberately different from a weak match: telling someone they
 * are a poor fit for work they never asked to be measured against is worse
 * than saying nothing.
 */
export function MatchBadge({
  match,
  showScore = false,
}: {
  match: JobMatch | null;
  /** The detail screen shows the number; a list card shows only the band. */
  showScore?: boolean;
}) {
  const t = useT();
  const { c } = useTheme();

  if (!match) return null;

  // Weak matches use the neutral surface rather than the danger colour: a
  // listing that does not fit is not an error, and painting it red would
  // discourage browsing outside someone's current trade.
  const tone =
    match.band === 'STRONG'
      ? { bg: c.successSoft, border: c.success, text: c.success }
      : match.band === 'GOOD'
        ? { bg: c.primarySoft, border: c.primarySoftBorder, text: c.text }
        : { bg: c.surfaceAlt, border: c.border, text: c.textMuted };

  return (
    <View
      style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}
    >
      <Text style={[styles.text, { color: tone.text }]}>
        {t(LABELS[match.band])}
        {showScore ? ` · ${match.score}%` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  text: { fontSize: font.xs - 1, fontWeight: '800' },
});
