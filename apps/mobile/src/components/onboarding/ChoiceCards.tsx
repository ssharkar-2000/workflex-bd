import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

export interface Choice<T extends string> {
  value: T;
  emoji: string;
  title: TranslationKey;
  body: TranslationKey;
}

/**
 * The stacked selectable cards from the reference form — one tap, a filled
 * radio, and a short line of explanation under each title.
 *
 * Generic over the value because the same control answers two different
 * questions depending on who is registering: experience level for someone
 * looking for work, individual-or-company for someone hiring.
 */
export function ChoiceCards<T extends string>({
  label,
  choices,
  selected,
  onSelect,
  error,
  required = true,
}: {
  label: string;
  choices: readonly Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  error?: string | null;
  required?: boolean;
}) {
  const t = useT();
  const { c } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.textOnBrand }]}>
        {label}
        {required ? <Text style={{ color: c.danger }}> *</Text> : null}
      </Text>

      {choices.map((choice) => {
        const active = selected === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onSelect(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.card,
              {
                borderColor: active
                  ? c.accentOnBrand
                  : error
                    ? c.danger
                    : c.glassBorder,
                backgroundColor: active ? c.glassHighlight : c.glassFill,
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                { borderColor: active ? c.accentOnBrand : c.glassBorder },
              ]}
            >
              {active ? (
                <View
                  style={[styles.dot, { backgroundColor: c.accentOnBrand }]}
                />
              ) : null}
            </View>

            <View style={styles.text}>
              <Text style={[styles.title, { color: c.textOnBrand }]}>
                {t(choice.title)}
              </Text>
              <Text style={[styles.body, { color: c.textMutedOnBrand }]}>
                {t(choice.body)}
              </Text>
            </View>

            <Text style={styles.emoji}>{choice.emoji}</Text>
          </Pressable>
        );
      })}

      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  text: { flex: 1 },
  title: { fontSize: font.md, fontWeight: '800' },
  body: { fontSize: font.xs, marginTop: 3, lineHeight: 17 },
  emoji: { fontSize: 26 },
  error: { fontSize: font.xs, fontWeight: '600', marginTop: 2 },
});
