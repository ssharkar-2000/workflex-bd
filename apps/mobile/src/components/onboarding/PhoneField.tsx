import { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextInput, View } from 'react-native';
import { sanitizeDigits } from '@workflex/shared';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

/**
 * Phone number with the +880 prefix, and nothing else.
 *
 * Replaces the old PhoneVerifyField, which sent and checked the SMS code in
 * place. Verification now happens on its own screen after the form is
 * submitted, so this is a plain input again.
 */
export function PhoneField({
  value,
  onChangeText,
  error,
  editable = true,
}: {
  value: string;
  onChangeText: (v: string) => void;
  error?: string | null;
  editable?: boolean;
}) {
  const t = useT();
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
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
      <Text style={[styles.label, { color: c.textOnBrand }]}>
        {t('login.phone')}
        <Text style={{ color: c.danger }}> *</Text>
      </Text>

      <Animated.View
        style={[
          styles.inputRow,
          {
            borderColor: error
              ? c.danger
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
        <Text style={styles.flag}>🇧🇩</Text>
        <Text style={[styles.prefix, { color: c.textOnBrand }]}>+880</Text>
        <View style={[styles.divider, { backgroundColor: c.glassBorder }]} />
        <TextInput
          style={[styles.input, { color: c.textOnBrand }]}
          value={value}
          onChangeText={(v) => onChangeText(sanitizeDigits(v, 11))}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={t('auth.phonePlaceholder')}
          placeholderTextColor={c.textMutedOnBrand}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={11}
          editable={editable}
        />
      </Animated.View>

      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : (
        <Text style={[styles.hint, { color: c.textMutedOnBrand }]}>
          {t('ob.phoneWillVerify')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  flag: { fontSize: 18 },
  prefix: { fontSize: font.md, fontWeight: '700' },
  divider: { width: 1, height: 24, marginHorizontal: 2 },
  input: { flex: 1, paddingVertical: 13, fontSize: font.md, fontWeight: '600' },
  error: { marginTop: 6, fontSize: font.xs, fontWeight: '600' },
  hint: { marginTop: 6, fontSize: font.xs },
});
