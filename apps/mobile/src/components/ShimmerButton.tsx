import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ElectricBorder } from './ElectricBorder';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

/**
 * Primary call to action.
 *
 * A highlight sweeps across the fill every few seconds and the whole control
 * dips on press. Both are small, but a button that responds physically is the
 * difference between a screen that feels built and one that feels templated.
 */
export function ShimmerButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled || loading) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        // Long pause so it reads as an occasional glint, not a busy animation.
        Animated.delay(2600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, disabled, loading]);

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <ElectricBorder
        radius={radius.lg}
        // Stops while the control cannot be used. A charge running around a
        // dead button is the interface promising something it will not do.
        active={!disabled && !loading}
        style={[styles.electric, { shadowColor: c.primary }]}
      >
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        onPressIn={() =>
          Animated.spring(press, {
            toValue: 1,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(press, {
            toValue: 0,
            useNativeDriver: true,
            speed: 40,
            bounciness: 6,
          }).start()
        }
        style={[styles.wrap, (disabled || loading) && styles.disabled]}
      >
        <LinearGradient
          colors={[c.primary, c.primaryPressed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-260, 260],
                  }),
                },
                { rotate: '18deg' },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.3)',
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glint}
          />
        </Animated.View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={c.primaryText} />
          ) : (
            <Text style={[styles.label, { color: c.primaryText }]}>{label}</Text>
          )}
        </View>
      </Pressable>
      </ElectricBorder>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The glow sits on the outer shell: a shadow drawn inside a parent that
  // clips its children is invisible, and the electric border clips.
  electric: {
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  wrap: {
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: { opacity: 0.5 },
  glint: { width: 90, height: '260%' },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: font.md, fontWeight: '800', letterSpacing: 0.2 },
});
