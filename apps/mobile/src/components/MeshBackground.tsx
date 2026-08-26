import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lib/use-theme';

/**
 * Icons scattered behind every screen, drawn from what the product is about:
 * shifts, trades, hiring, payment, verification. A patterned page reads as a
 * designed surface rather than an empty one, and keeping the vocabulary on
 * topic means the texture also says what the app does.
 */
const DOODLES = [
  '💼', '🛠️', '🪪', '💸', '⏰', '📍', '🤝', '👷', '💻', '📋',
  '🚚', '🍽️', '🏥', '🎓', '⭐', '✅', '🔧', '📦', '🧾', '🏗️',
  '🧰', '🚀', '📱', '🗓️', '🏭', '🧑‍🍳', '🛵', '🧹', '💰', '📊',
];

/** Fixed layout: a reshuffle on every render would be visible and cheap-looking. */
const CELL = 78;

interface Blob {
  size: number;
  color: string;
  opacity: number;
  top: number;
  left: number;
  driftX: number;
  driftY: number;
  duration: number;
}

export function MeshBackground() {
  const { c } = useTheme();

  const blobs = useMemo<Blob[]>(
    () => [
      {
        size: 320,
        color: c.orbs[0],
        opacity: 0.5,
        top: -80,
        left: -90,
        driftX: 26,
        driftY: 34,
        duration: 9000,
      },
      {
        size: 260,
        color: c.orbs[1],
        opacity: 0.38,
        top: 150,
        left: 210,
        driftX: -32,
        driftY: 26,
        duration: 11000,
      },
      {
        size: 380,
        color: c.orbs[2],
        opacity: 0.42,
        top: 380,
        left: -130,
        driftX: 30,
        driftY: -28,
        duration: 13000,
      },
    ],
    [c],
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} pointerEvents="none">
      <LinearGradient
        colors={[...c.gradient]}
        locations={[0, 0.36, 0.7, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {blobs.map((blob, i) => (
        <DriftingBlob key={i} blob={blob} index={i} />
      ))}

      <DoodleLayer opacity={c.doodleOpacity} />
    </View>
  );
}

/**
 * The doodles drift as one sheet, very slowly. Moving them individually would
 * be a lot of animated nodes for a decoration nobody should consciously notice.
 */
function DoodleLayer({ opacity }: { opacity: number }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const cells = useMemo(() => {
    const out: { key: string; icon: string; top: number; left: number; size: number; rotate: string }[] = [];
    const columns = 6;
    const rows = 14;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        // Deterministic pseudo-random offsets so the grid never looks like one.
        const jitterX = ((index * 37) % 26) - 13;
        const jitterY = ((index * 53) % 26) - 13;
        const size = 20 + ((index * 17) % 12);
        const rotate = `${((index * 43) % 40) - 20}deg`;

        out.push({
          key: `${row}-${col}`,
          icon: DOODLES[index % DOODLES.length] ?? '💼',
          left: col * CELL + jitterX - 20,
          top: row * CELL + jitterY - 20,
          size,
          rotate,
        });
      }
    }
    return out;
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity,
          transform: [
            {
              translateY: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -22],
              }),
            },
          ],
        },
      ]}
    >
      {cells.map((cell) => (
        <Text
          key={cell.key}
          style={{
            position: 'absolute',
            top: cell.top,
            left: cell.left,
            fontSize: cell.size,
            transform: [{ rotate: cell.rotate }],
          }}
        >
          {cell.icon}
        </Text>
      ))}
    </Animated.View>
  );
}

function DriftingBlob({ blob, index }: { blob: Blob; index: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: blob.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: blob.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, blob.duration]);

  const gradientId = `blob-${index}`;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: blob.top,
        left: blob.left,
        opacity: blob.opacity,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, blob.driftX],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, blob.driftY],
            }),
          },
        ],
      }}
    >
      <Svg width={blob.size} height={blob.size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blob.color} stopOpacity="1" />
            <Stop offset="0.55" stopColor={blob.color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={blob.color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle
          cx={blob.size / 2}
          cy={blob.size / 2}
          r={blob.size / 2}
          fill={`url(#${gradientId})`}
        />
      </Svg>
    </Animated.View>
  );
}
