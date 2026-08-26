import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { font } from '../../lib/theme';

const NAME = 'WorkFlex BD';

/**
 * The system name on the registration band, animated per letter.
 *
 * Two moves, both on the native driver so the form and the keyboard keep the
 * JS thread to themselves: the letters cascade up on mount, then a slow wave
 * travels through them every few seconds. Everything is transform and opacity
 * — no colour interpolation, which would force the animation onto JS.
 *
 * One `Animated.Value` per move, read at a per-letter offset, rather than one
 * value and one timer per letter. Eleven timers for a wordmark would be a lot
 * of bookkeeping for an effect this small.
 */
export function BrandWordmark({ color }: { color: string }) {
  const chars = useMemo(() => Array.from(NAME), []);

  const enter = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entrance = Animated.timing(enter, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Long pause: this sits above a form someone is typing into, so it
        // should read as an occasional glint, not a thing that keeps moving.
        Animated.delay(3800),
      ]),
    );

    // The wave only starts once the letters have all arrived, so the two
    // never overlap and fight for the same transform.
    entrance.start(({ finished }) => {
      if (finished) loop.start();
    });

    return () => {
      entrance.stop();
      loop.stop();
    };
  }, [enter, wave]);

  return (
    // Grouped for screen readers: without this the row would be announced one
    // letter at a time.
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={NAME}
    >
      {chars.map((ch, i) => {
        // Entrance: each letter opens a little after the one before it.
        //
        // Input ranges are the letter's own window and nothing else, with
        // clamping doing the work outside it. Padding them out to [0, …, 1]
        // would put a duplicate bound on the first letter, whose window opens
        // at 0 — and a zero-width segment divides by zero on the native driver.
        const start = i * 0.055;
        const end = start + 0.42;

        const opacity = enter.interpolate({
          inputRange: [start, end],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        });
        const rise = enter.interpolate({
          inputRange: [start, end],
          outputRange: [11, 0],
          extrapolate: 'clamp',
        });

        // Wave: a 4px dip that travels along the word and settles.
        const w0 = i * 0.045;
        const dip = wave.interpolate({
          inputRange: [w0, w0 + 0.1, w0 + 0.2],
          outputRange: [0, -4, 0],
          extrapolate: 'clamp',
        });

        return (
          <Animated.Text
            key={`${ch}-${i}`}
            style={[
              styles.letter,
              {
                color,
                opacity,
                transform: [{ translateY: Animated.add(rise, dip) }],
              },
            ]}
          >
            {ch}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  letter: {
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
