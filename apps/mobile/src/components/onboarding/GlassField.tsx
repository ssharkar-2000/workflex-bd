import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

/**
 * Labelled input for the panels that sit on the gradient. The border lifts to
 * the brand highlight on focus and to red on error, so validation state is
 * visible without reading the message.
 */
export function GlassField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  optional = false,
  keyboardType,
  autoCapitalize = 'words',
  multiline = false,
  hint,
  sanitize,
  maxLength,
  secureTextEntry = false,
  required = false,
  icon,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Applied on every keystroke so invalid characters never appear. */
  sanitize?: (v: string) => string;
  maxLength?: number;
  placeholder?: string;
  error?: string | null;
  optional?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  multiline?: boolean;
  hint?: string;
  secureTextEntry?: boolean;
  /** Red asterisk after the label, matching the reference form. */
  required?: boolean;
  /** Glyph shown inside the field, before the text. */
  icon?: string;
  autoComplete?: 'name' | 'email' | 'tel' | 'password' | 'off';
}) {
  const t = useT();
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  // Revealing the password is worth offering: on a phone keyboard a hidden
  // field with four character-class rules is a common place to give up.
  const [revealed, setRevealed] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const setFocus = (next: boolean) => {
    setFocused(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text
          style={[styles.label, { color: c.textOnBrand }]}
          numberOfLines={2}
        >
          {label}
          {required ? (
            <Text style={{ color: c.danger }}> *</Text>
          ) : null}
        </Text>
        {optional ? (
          <Text
            style={[styles.optional, { color: c.textMutedOnBrand }]}
            numberOfLines={1}
          >
            {t('ob.optionalField')}
          </Text>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          {
            borderColor: error
              ? 'rgba(255,150,145,0.85)'
              : anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [c.glassBorder, c.accentOnBrand],
                }),
            backgroundColor: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [c.glassFill, c.glassHighlight],
            }),
          },
        ]}
      >
        {icon ? (
          <Text style={[styles.icon, { color: c.textMutedOnBrand }]}>
            {icon}
          </Text>
        ) : null}

        <TextInput
          style={[
            styles.input,
            { color: c.textOnBrand },
            multiline && styles.inputMultiline,
          ]}
          autoComplete={autoComplete}
          value={value}
          onChangeText={(v) => onChangeText(sanitize ? sanitize(v) : v)}
          maxLength={maxLength}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          placeholderTextColor={c.textMutedOnBrand}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          secureTextEntry={secureTextEntry && !revealed}
        />

        {secureTextEntry ? (
          <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={10}>
            <Text style={[styles.reveal, { color: c.accentOnBrand }]}>
              {revealed ? t('ob.passwordHide') : t('ob.passwordShow')}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>

      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: c.textMutedOnBrand }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
    // Fixed height so a two-line label does not push its input out of step
    // with the single-line field beside it in a two-column row.
    minHeight: 38,
  },
  label: {
    flexShrink: 1,
    fontSize: font.sm,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Never squeezed off the edge of a narrow column.
  optional: { flexShrink: 0, fontSize: font.xs, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  inputWrapMultiline: { paddingVertical: 4 },
  icon: { fontSize: font.md, marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: font.md },
  inputMultiline: { minHeight: 76 },
  reveal: { fontSize: font.xs, fontWeight: '700' },
  error: { marginTop: 6, fontSize: font.xs, fontWeight: '600' },
  hint: { marginTop: 6, fontSize: font.xs, lineHeight: 17 },
});
