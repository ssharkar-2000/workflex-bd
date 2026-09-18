import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  Path,
  RadialGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { useTheme } from '../lib/use-theme';

/**
 * The animated brand mark: a locator sweeping for shifts nearby, with the
 * trades orbiting it.
 *
 * It replaces a static job-card drawing. The radar reads as "work near you",
 * which is the promise on the landing screen, and the orbit carries the
 * category vocabulary — trades, kitchens, delivery, care, desk work — so the
 * mark says what the marketplace covers without a caption.
 *
 * Everything animates on the native driver, so the whole thing costs nothing
 * on the JS thread even while the screen is doing its entrance sequence.
 */

/** The trades that orbit the locator, in the order they sit on the ring. */
const ORBIT = ['🛠️', '🍽️', '🚚', '🏥', '💻'] as const;

/** SVG gradient ids are global, so two marks on one screen must not collide. */
let instanceCount = 0;

export function BrandMark({
  size = 200,
  interactive = true,
}: {
  size?: number;
  /** Splash and other passive placements skip the press affordance. */
  interactive?: boolean;
}) {
  const { c } = useTheme();
  const sweepId = useRef(`mark-sweep-${instanceCount++}`).current;

  const spin = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  // Three rings on the same loop, read at staggered offsets — one driver for
  // the whole pulse instead of three competing timers.
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 22000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.timing(sweep, {
          toValue: 1,
          duration: 3600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [spin, sweep, pulse, breathe]);

  const onPress = () => {
    burst.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(press, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(press, {
          toValue: 0,
          friction: 4,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(burst, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const center = size / 2;
  const coreSize = size * 0.4;
  const orbitRadius = size * 0.375;
  const nodeSize = size * 0.17;
  const ringSize = size * 0.5;

  const nodes = useMemo(
    () =>
      ORBIT.map((icon, i) => {
        const angle = (i / ORBIT.length) * Math.PI * 2 - Math.PI / 2;
        return {
          icon,
          left: center + Math.cos(angle) * orbitRadius - nodeSize / 2,
          top: center + Math.sin(angle) * orbitRadius - nodeSize / 2,
        };
      }),
    [center, orbitRadius, nodeSize],
  );

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  // Nodes turn against the ring at the same rate, so the icons never tip over.
  const counterRotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const sweepRotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const coreScale = Animated.add(
    breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [0, -0.12] }),
  );

  const Wrapper = interactive ? Pressable : View;

  return (
    <Wrapper
      onPress={interactive ? onPress : undefined}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel="WorkFlex BD"
      style={{ width: size, height: size }}
    >
      {/* Radar rings, expanding outward from the core */}
      {[0, 0.33, 0.66].map((offset, i) => (
        <PulseRing
          key={i}
          pulse={pulse}
          offset={offset}
          size={ringSize}
          left={center - ringSize / 2}
          top={center - ringSize / 2}
          color={c.primary}
        />
      ))}

      {/* One-shot ring on tap, so the mark answers a touch */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            left: center - ringSize / 2,
            top: center - ringSize / 2,
            borderColor: c.accent,
            opacity: burst.interpolate({
              inputRange: [0, 1],
              outputRange: [0.65, 0],
            }),
            transform: [
              {
                scale: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 2],
                }),
              },
            ],
          },
        ]}
      />

      {/* The sweep arm */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: sweepRotate }] },
        ]}
      >
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={sweepId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.primary} stopOpacity="0.34" />
              <Stop offset="1" stopColor={c.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={wedgePath(center, size * 0.46)} fill={`url(#${sweepId})`} />
          <Circle
            cx={center}
            cy={center}
            r={size * 0.46}
            stroke={c.primary}
            strokeOpacity={0.18}
            strokeWidth={1}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Trades orbiting the locator */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate }] },
        ]}
      >
        {nodes.map((node) => (
          <Animated.View
            key={node.icon}
            style={[
              styles.node,
              {
                width: nodeSize,
                height: nodeSize,
                borderRadius: nodeSize / 2,
                left: node.left,
                top: node.top,
                backgroundColor: c.surface,
                borderColor: c.glassBorder,
                transform: [{ rotate: counterRotate }],
              },
            ]}
          >
            <Text style={{ fontSize: nodeSize * 0.52 }}>{node.icon}</Text>
          </Animated.View>
        ))}
      </Animated.View>

      {/* The core */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: center - coreSize / 2,
          top: center - coreSize / 2,
          transform: [{ scale: coreScale }],
        }}
      >
        <LinearGradient
          colors={[c.accent, c.primary, c.primaryPressed]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
            },
          ]}
        >
          <Svg width={coreSize * 0.56} height={coreSize * 0.56} viewBox="0 0 24 24">
            {/* A map pin with a bolt through it: work, located, right now. */}
            <Path
              d="M12 1.6c-4 0-7.2 3.1-7.2 7 0 5.1 7.2 14 7.2 14s7.2-8.9 7.2-14c0-3.9-3.2-7-7.2-7z"
              fill={c.primaryText}
              fillOpacity={0.22}
            />
            <Path
              d="M12 1.6c-4 0-7.2 3.1-7.2 7 0 5.1 7.2 14 7.2 14s7.2-8.9 7.2-14c0-3.9-3.2-7-7.2-7z"
              stroke={c.primaryText}
              strokeWidth={1.6}
              fill="none"
              strokeLinejoin="round"
            />
            <Path
              d="M12.9 4.9 9.4 9.6h2.4l-1.1 4 3.6-4.9h-2.5l1.1-3.8z"
              fill={c.primaryText}
            />
          </Svg>
        </LinearGradient>
      </Animated.View>
    </Wrapper>
  );
}

/** A 60° wedge from the centre — the radar arm. */
function wedgePath(center: number, r: number): string {
  const x = center + r * Math.cos(-Math.PI / 3);
  const y = center + r * Math.sin(-Math.PI / 3);
  return `M${center} ${center} L${center + r} ${center} A${r} ${r} 0 0 0 ${x} ${y} Z`;
}

function PulseRing({
  pulse,
  offset,
  size,
  left,
  top,
  color,
}: {
  pulse: Animated.Value;
  offset: number;
  size: number;
  left: number;
  top: number;
  color: string;
}) {
  // Reading one driver at an offset wraps past 1, so the ring is described in
  // two halves that meet at the seam — the alternative is a second timer per
  // ring for an effect nobody looks at directly. At offset 0 there is no seam,
  // and describing one would make the input range non-monotonic.
  const shifted =
    offset === 0
      ? pulse
      : pulse.interpolate({
          inputRange: [0, 1 - offset, 1 - offset + 0.0001, 1],
          outputRange: [offset, 1, 0, offset],
        });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left,
          top,
          borderColor: color,
          opacity: shifted.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 0.42, 0],
          }),
          transform: [
            {
              scale: shifted.interpolate({
                inputRange: [0, 1],
                outputRange: [0.72, 1.95],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5 },
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // Lifts the trades off the sweep so they stay readable as it passes under.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  core: { alignItems: 'center', justifyContent: 'center' },
});
