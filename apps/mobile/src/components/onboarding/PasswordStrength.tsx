import { StyleSheet, Text, View } from 'react-native';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

/**
 * Four-segment strength bar under the password field, as in the reference.
 *
 * Scored against the same four character classes the shared `passwordSchema`
 * enforces, plus length — so a full bar means the password will actually be
 * accepted. A meter that reads "Strong" and then fails validation is worse
 * than no meter.
 */
function score(password: string): number {
  if (!password) return 0;

  let points = 0;
  if (/[a-z]/.test(password)) points++;
  if (/[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;

  // Length gates the top rung: all four classes in seven characters is still
  // short enough to be worth flagging, and the schema rejects it anyway.
  if (password.length < 8) return Math.min(points, 2);
  return points;
}

const LABELS: Record<number, TranslationKey> = {
  0: 'ob.strength.none',
  1: 'ob.strength.weak',
  2: 'ob.strength.weak',
  3: 'ob.strength.fair',
  4: 'ob.strength.strong',
};

export function PasswordStrength({ password }: { password: string }) {
  const t = useT();
  const { c } = useTheme();
  const value = score(password);

  const colour =
    value >= 4 ? c.success : value === 3 ? c.warning : value > 0 ? c.danger : c.glassBorder;

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i < value ? colour : c.glassBorder },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: c.textMutedOnBrand }]}>
        {t(LABELS[value] ?? 'ob.strength.none')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  bars: { flex: 1, flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: 4, borderRadius: radius.pill },
  label: { fontSize: font.xs, fontWeight: '700' },
});
