import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lib/use-theme';

/**
 * Aurora effect on real typography.
 *
 * The text is a normal <Text>, used as a mask over a wide gradient that slides
 * beneath it. That matters: an earlier version drew the wordmark as SVG text,
 * which ignores font weight and letter spacing on Android and reads flat.
 * Masking keeps real font rendering and puts the colour behind it.
 *
 * The sweep runs on the native driver, so it costs nothing on the JS thread.
 */
export function AuroraText({
  children,
  fontSize = 44,
  height,
}: {
  children: string;
  fontSize?: number;
  height?: number;
}) {
  const { isDark } = useTheme();
  const sweep = useRef(new Animated.Value(0)).current;
  const rowHeight = height ?? fontSize * 1.35;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  // The gradient is three screens wide and travels exactly one screen, so the
  // loop point lands on an identical colour and the restart is invisible.
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-SWEEP_WIDTH / 3, 0],
  });

  return (
    <MaskedView
      style={{ height: rowHeight }}
      maskElement={
        <View style={styles.maskWrap}>
          <Text
            style={[
              styles.label,
              { fontSize, lineHeight: rowHeight, letterSpacing: -1.2 },
            ]}
          >
            {children}
          </Text>
        </View>
      }
    >
      <Animated.View
        style={{ width: SWEEP_WIDTH, height: rowHeight, transform: [{ translateX }] }}
      >
        <LinearGradient
          colors={[...AURORA_STOPS[isDark ? 'dark' : 'light']]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </MaskedView>
  );
}

const SWEEP_WIDTH = 1200;

// Deep indigo through coral, matching the reskin. Kept to a narrow band of
// the palette rather than saturated hues: the wordmark has to stay legible at
// a glance, which a rainbow sweep does not do.
//
// Light mode stays dark-on-pale — pastels are background colours and vanish
// as type. Dark mode inverts to the warm end, because the indigos are the
// darkest thing in the palette and would sink into the page.
const AURORA_STOPS = {
  light: [
    '#1E1E3C',
    '#3A2F63',
    '#7A3F55',
    '#C2512A',
    '#8A3C58',
    '#2A2450',
    '#1E1E3C',
    '#1E1E3C',
  ],
  dark: [
    '#FFAA79',
    '#FFD2B0',
    '#FF9D6A',
    '#F5B7C4',
    '#FFE1CB',
    '#FFAA79',
    '#FFC59C',
    '#FFAA79',
  ],
} as const;

const styles = StyleSheet.create({
  maskWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  label: {
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
  },
});
