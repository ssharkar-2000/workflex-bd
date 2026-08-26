import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LOCALE_LABELS, type Locale } from '@workflex/shared';
import { useLocale } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

const LOCALES: Locale[] = ['bn', 'en'];

/**
 * Sits on the landing screen, not buried in settings: a user who cannot read
 * the sign-in screen cannot reach settings to change it.
 */
export function LanguageToggle({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [locale, setLocale] = useLocale();
  const { c } = useTheme();
  const onGradient = tone === 'light';

  return (
    <View
      style={[
        styles.wrap,
        onGradient
          ? { backgroundColor: c.glassFill, borderColor: c.glassBorder }
          : { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <Pressable
            key={code}
            onPress={() => void setLocale(code)}
            style={[styles.option, active && { backgroundColor: c.primary }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={4}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? c.primaryText
                    : onGradient
                      ? c.textMutedOnBrand
                      : c.textMuted,
                },
              ]}
            >
              {LOCALE_LABELS[code]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  label: { fontSize: font.xs, fontWeight: '700' },
});
