import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

/**
 * Inline validation message, directly under the field it belongs to.
 *
 * It shakes once on appearance and on every subsequent message. Motion is
 * doing real work here: a user who mistypes a number is usually not reading
 * carefully, and the movement pulls attention to the line without a modal or
 * a toast that covers the input they need to fix.
 */
export function ErrorBanner({
  message,
  tone = 'onGradient',
}: {
  message: string | null;
  tone?: 'onGradient' | 'onSurface';
}) {
  const { c, isDark } = useTheme();
  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) {
      Animated.timing(enter, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      return;
    }

    shake.setValue(0);
    Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
    ]).start();
  }, [message, enter, shake]);

  if (!message) return null;

  const onGradient = tone === 'onGradient';

  return (
    <Animated.View
      style={[
        styles.wrap,
        // The washed pink treatment only works against a dark page. Since the
        // reskin the light-mode background is pale, so light mode uses the
        // solid danger tokens in both tones — pale pink on pale peach is
        // invisible, which is the one thing an error must never be.
        onGradient && isDark
          ? {
              backgroundColor: 'rgba(190,40,35,0.22)',
              borderColor: 'rgba(255,150,145,0.5)',
            }
          : { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
            {
              translateX: shake.interpolate({
                inputRange: [-1, 1],
                outputRange: [-7, 7],
              }),
            },
          ],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          styles.icon,
          { color: onGradient && isDark ? '#FFC9C5' : c.danger },
        ]}
      >
        ⚠
      </Text>
      <Text
        style={[
          styles.text,
          { color: onGradient && isDark ? '#FFE0DE' : c.danger },
        ]}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  icon: { fontSize: font.xs, lineHeight: 19 },
  text: { flex: 1, fontSize: font.sm, lineHeight: 19, fontWeight: '600' },
});
