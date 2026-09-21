import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LOCALE_LABELS, type Locale } from '@workflex/shared';
import { useLocale, useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

const LOCALES: Locale[] = ['bn', 'en'];

/** Each option is the same width, so the highlight can slide between them. */
const SEGMENT = 72;
const PAD = 3;

/**
 * Sits on the landing screen, not buried in settings: a user who cannot read
 * the sign-in screen cannot reach settings to change it.
 *
 * A segmented control: the chosen language sits on a filled highlight that
 * slides across when the other is picked, so which one is on reads at a
 * glance — the old version marked it with a small pill that was easy to miss.
 * Screen readers get it as a pair of radio buttons under "Language".
 */
export function LanguageToggle({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const t = useT();
  const [locale, setLocale] = useLocale();
  const { c } = useTheme();
  const onGradient = tone === 'light';

  const index = Math.max(0, LOCALES.indexOf(locale));
  const slide = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(slide, {
      toValue: index,
      speed: 18,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [index, slide]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('common.language')}
      style={[
        styles.wrap,
        onGradient
          ? { backgroundColor: c.glassFill, borderColor: c.glassBorder }
          : { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: c.primary,
            shadowColor: c.primary,
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, SEGMENT],
                }),
              },
            ],
          },
        ]}
      />
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <Pressable
            key={code}
            onPress={() => void setLocale(code)}
            accessibilityRole="radio"
            accessibilityLabel={LOCALE_LABELS[code]}
            aria-checked={active}
            hitSlop={4}
            style={({ pressed }) => [
              styles.option,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                active
                  ? styles.labelActive
                  : { color: onGradient ? c.textMutedOnBrand : c.textMuted },
                active && { color: c.primaryText },
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
    padding: PAD,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    width: SEGMENT,
    borderRadius: radius.pill,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  option: {
    width: SEGMENT,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.6 },
  label: { fontSize: font.sm - 1, fontWeight: '600' },
  labelActive: { fontWeight: '800' },
});
