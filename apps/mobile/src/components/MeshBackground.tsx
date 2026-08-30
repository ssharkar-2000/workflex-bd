import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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

/**
 * Spacing between icons.
 *
 * Widened from 78 to thin the pattern out: at 78 a phone carried eighty-odd
 * icons and the background read as wallpaper rather than as scattered
 * texture. The grid is now sized from the actual viewport instead of a fixed
 * row and column count, so it covers the whole page on a tall phone and on a
 * wide desktop alike — the old 6 × 14 grid stopped less than 500px across and
 * left most of a browser window bare.
 */
const CELL = 155;

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
 * The scattered icons behind every screen, now with their own small drift.
 *
 * Two motions are layered. The whole sheet still rises and falls very slowly,
 * which reads as depth. On top of that each icon traces a small ellipse of a
 * few pixels, so the background is quietly alive rather than a printed
 * pattern.
 *
 * The icons are grouped into four bands rather than animated one by one. There
 * are eighty-four of them, and giving each its own driver would put hundreds
 * of interpolated nodes behind a decoration nobody should consciously notice —
 * on the cheap Android handsets this app is built for, that is a real cost for
 * an effect nobody asked to see. Four bands at different periods, interleaved
 * across the grid so neighbours are never in the same one, look independent at
 * any distance a person actually views them from.
 */
/**
 * Four periods, four directions, four tiny rotations.
 *
 * `spin` is deliberately under a degree. Rotating a full-screen band moves
 * icons in proportion to their distance from its centre — at 2.5deg an icon
 * near the edge travels 17px while one in the middle travels 6, and the whole
 * corner swinging together reads as the page tilting rather than icons
 * floating. Under a degree the edge moves about 5px, the same order as the
 * translation, so it adds variation across the screen instead of a tilt.
 */
const BANDS = [
  { duration: 15000, x: 5, y: 7, spin: 0.8 },
  { duration: 19000, x: -7, y: 4, spin: -0.6 },
  { duration: 23000, x: 4, y: -6, spin: 0.5 },
  { duration: 27000, x: -5, y: -5, spin: -0.9 },
];

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

  // Sized from the viewport, plus a cell of bleed so a rotating or drifting
  // icon never reveals an empty edge.
  const { width, height } = useWindowDimensions();

  const cells = useMemo(() => {
    const out: {
      key: string;
      icon: string;
      top: number;
      left: number;
      size: number;
      rotate: string;
      band: number;
    }[] = [];
    const columns = Math.ceil(width / CELL) + 1;
    const rows = Math.ceil(height / CELL) + 1;

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
          // row + col, not the flat index: with six columns a flat index would
          // put every fourth icon in the same band down a diagonal, and the
          // eye picks that out immediately.
          band: (row + col) % BANDS.length,
        });
      }
    }
    return out;
  }, [width, height]);

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
      {BANDS.map((band, i) => (
        <WanderBand
          key={i}
          band={band}
          cells={cells.filter((cell) => cell.band === i)}
        />
      ))}
    </Animated.View>
  );
}

/**
 * One band of icons, tracing a slow ellipse.
 *
 * The ellipse comes from reading a single 0→1 driver at quarter points: X
 * peaks where Y crosses zero and vice versa, which is a circle in the same way
 * sine and cosine make one. A straight back-and-forth would read as a twitch;
 * going around reads as floating.
 */
function WanderBand({
  band,
  cells,
}: {
  band: (typeof BANDS)[number];
  cells: {
    key: string;
    icon: string;
    top: number;
    left: number;
    size: number;
    rotate: string;
  }[];
}) {
  const wander = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(wander, {
        toValue: 1,
        duration: band.duration,
        // Linear, because the path already turns — easing a loop that returns
        // to its start makes it visibly hesitate at the seam.
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [wander, band.duration]);

  const quarters = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            {
              translateX: wander.interpolate({
                inputRange: quarters,
                outputRange: [0, band.x, 0, -band.x, 0],
              }),
            },
            {
              translateY: wander.interpolate({
                inputRange: quarters,
                outputRange: [band.y, 0, -band.y, 0, band.y],
              }),
            },
            {
              rotate: wander.interpolate({
                inputRange: quarters,
                outputRange: [
                  '0deg',
                  `${band.spin}deg`,
                  '0deg',
                  `${-band.spin}deg`,
                  '0deg',
                ],
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
