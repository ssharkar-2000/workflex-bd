import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useT, type TranslationKey } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, space } from '../lib/theme';

const KEYS: TranslationKey[] = [
  'auth.rotate.1',
  'auth.rotate.2',
  'auth.rotate.3',
];

const HOLD_MS = 3200;

/**
 * Cycles the three value propositions so the screen keeps saying something
 * new while the user reads it. Each line covers a different audience —
 * worker, employer, both — which a single static tagline cannot do.
 */
export function RotatingTagline() {
  const t = useT();
  const { c } = useTheme();
  const [index, setIndex] = useState(0);
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setIndex((i) => (i + 1) % KEYS.length);
        Animated.timing(anim, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }, HOLD_MS);

    return () => clearInterval(timer);
  }, [anim]);

  return (
    <View style={styles.wrap}>
      <Animated.Text
        style={[
          styles.text,
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
        numberOfLines={2}
      >
        <Text style={{ color: c.textMutedOnBrand }}>
          {t(KEYS[index] ?? 'auth.tagline')}
        </Text>
      </Animated.Text>

      <View style={styles.dots}>
        {KEYS.map((key, i) => (
          <View
            key={key}
            style={[
              styles.dot,
              { backgroundColor: c.glassBorder },
              i === index && { backgroundColor: c.primary, width: 18 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: space.sm },
  text: {
    // Fixed height so the layout below never jumps as lines change length.
    height: 46,
    fontSize: font.md,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: space.lg,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 2 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
