import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { BrandName } from '../BrandName';
import { font } from '../../lib/theme';

/**
 * The logotype on the registration band, rising into place as the step
 * opens.
 *
 * It used to spell the name letter by letter in the band's text colour, with
 * a wave passing through the letters. The name is now the drawn logotype, one
 * piece, so it arrives as one: a short fade and lift on the native driver,
 * then it stays still — it sits above a form someone is typing into.
 */
export function BrandWordmark({ size = font.lg }: { size?: number }) {
  // `size` is the type size the band was laid out for; the logotype is drawn
  // a little taller than a line of that type, so it reads at the same scale.
  const height = Math.round(size * 1.3);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entrance = Animated.timing(enter, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [height * 0.3, 0],
            }),
          },
        ],
      }}
    >
      {/* The band is pale blue in both themes, so the letters take dark ink. */}
      <BrandName height={height} surface="light" accessibilityRole="header" />
    </Animated.View>
  );
}
