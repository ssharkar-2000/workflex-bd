import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lib/use-theme';

/**
 * An animated charge running around a control's edge.
 *
 * The trick is a gradient larger than the control, rotating behind it, with
 * the content laid over the top inset by the border width. Only the ring
 * around the edge is ever visible, so a plain rotation reads as light
 * travelling around the perimeter. Drawing the ring itself would mean
 * animating a path, which React Native has no cheap way to do.
 *
 * The gradient has to be as wide as the control's diagonal, or the corners
 * sweep through empty space and the light appears to blink out four times a
 * turn.
 *
 * Colours come from the palette rather than the neon a effect like this
 * usually reaches for: the point is to draw the eye to the primary action,
 * and a colour the product does not otherwise use would read as a different
 * app's button.
 */
export function ElectricBorder({
  children,
  radius,
  /** Off while a button is disabled or busy — a glowing dead control lies. */
  active = true,
  /** How thick the visible ring is. */
  width = 1.5,
  style,
}: {
  children: React.ReactNode;
  radius: number;
  active?: boolean;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);

  // An animated glow is exactly what someone with a vestibular disorder turns
  // this setting on to avoid, so the ring goes static rather than ignoring it.
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const running = active && !reduceMotion && size.width > 0;

  useEffect(() => {
    if (!running) {
      spin.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4200,
        // Linear, because the loop returns to its own start — easing makes the
        // seam visible as a hesitation once per turn.
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [running, spin]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== size.width || h !== size.height) setSize({ width: w, height: h });
  };

  // Square, and long enough to cover the corners throughout a full rotation.
  const sweep = Math.hypot(size.width, size.height);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.shell,
        {
          borderRadius: radius,
          // The ring is a solid fill first and an animation second.
          //
          // The rotating sweep can only be sized once the control has been
          // measured, and until then it cannot render at all — which left the
          // button with no border on its first frames, and none whatsoever
          // wherever layout events are delayed. Painting the shell means the
          // edge is correct immediately and the sweep only adds the travelling
          // highlight on top of it.
          backgroundColor: active ? c.primary : c.border,
        },
        style,
      ]}
    >
      {size.width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            {
              width: sweep,
              height: sweep,
              left: (size.width - sweep) / 2,
              top: (size.height - sweep) / 2,
              transform: [{ rotate }],
              // A static ring when motion is reduced still marks the control,
              // it simply stops moving.
              opacity: active ? 1 : 0,
            },
          ]}
        >
          <LinearGradient
            // Bright arc, then a long fade, so one charge travels the edge
            // rather than the whole ring glowing at once.
            colors={[c.accent, c.primary, 'transparent', 'transparent']}
            locations={[0, 0.18, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      {/* Inset by the border width, which is what leaves the ring visible. */}
      <View
        style={[
          styles.inner,
          {
            margin: width,
            borderRadius: Math.max(0, radius - width),
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clips the rotating square to the control's shape.
  shell: { overflow: 'hidden' },
  sweep: { position: 'absolute' },
  inner: { overflow: 'hidden' },
});
