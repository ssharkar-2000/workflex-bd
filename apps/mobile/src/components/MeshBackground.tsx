import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { JOB_CATEGORIES } from '@workflex/shared';
import { useTheme } from '../lib/use-theme';

/**
 * Icons scattered behind every screen, drawn from what the product is about:
 * shifts, trades, hiring, payment, verification. A patterned page reads as a
 * designed surface rather than an empty one, and keeping the vocabulary on
 * topic means the texture also says what the app does.
 */
const DOODLES = [
  // Every kind of work the product actually lists, taken from the taxonomy
  // itself rather than a hand-kept copy of it. Add a category and it joins the
  // background; rename one and nothing here goes stale.
  ...JOB_CATEGORIES.map((category) => category.emoji),

  // The platform's own mechanics, which are not job categories but are just as
  // much what this app is: NID verification, bKash payment, shift times,
  // nearby work, and being hired.
  '🪪',
  '💸',
  '⏰',
  '📍',
  '🤝',
];

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
 * How much page each icon gets.
 *
 * The layer used to be a fixed 155px grid with a jitter of a few pixels, which
 * still read as a grid — a small jitter against a fixed pitch is a grid with
 * soft edges, and the eye finds the rows anyway. Density is now expressed as
 * area per icon, so a tall phone and a wide browser window get the same
 * *texture* rather than the same count.
 */
const AREA_PER_ICON = 45_000;

/**
 * Bounds on that density: never so few the page looks bare, never so many it
 * reads as wallpaper. These constrain the target the layout aims at, not the
 * final count — `scatter` rounds the target to whole rows and columns, so a
 * desktop lands a little above the maximum and a phone a little above the
 * minimum. Coverage matters more here than hitting an exact number.
 */
const MIN_ICONS = 8;
const MAX_ICONS = 22;

/**
 * Size range.
 *
 * Varying size is what stops a scatter looking like confetti: a few large
 * icons and many small ones reads as depth, where one uniform size reads as a
 * pattern. The small ones are drawn slightly fainter too, the same cue a real
 * out-of-focus background gives.
 *
 * The floor was 15px, which is where an emoji glyph stops being legible as a
 * picture and becomes a smudge — the "blurry" look. 22px is small enough to
 * stay background and large enough to read as the thing it depicts.
 */
const MIN_SIZE = 22;
const MAX_SIZE = 46;

/**
 * A deterministic hash in [0, 1).
 *
 * Deliberately not Math.random: the layout has to be identical on every render
 * and every mount, or icons would jump to new positions each time a screen
 * re-renders. Same seed, same page — while still looking unplanned.
 */
function hash(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface Doodle {
  key: string;
  icon: string;
  top: number;
  left: number;
  size: number;
  rotate: string;
  /** Fainter when small, so size reads as distance. */
  depth: number;
  band: number;
  /** Where this icon sits on its band's ellipse, 0–1. */
  phase: number;
}

/**
 * The vocabulary in a fixed shuffled order.
 *
 * Icons are then taken in sequence, which guarantees a screen shows as many
 * different ones as it has room for. Picking each independently at random
 * looked repetitive — with 25 icons in 10 slots the birthday problem makes a
 * duplicate almost certain, and a repeated emoji is the one thing that gives
 * a "random" background away as generated.
 */
const SHUFFLED = DOODLES.map((icon, i) => ({ icon, at: hash(i * 31 + 7) }))
  .sort((a, b) => a.at - b.at)
  .map((entry) => entry.icon);

/**
 * How far inside its cell an icon may wander, as a fraction of the cell.
 *
 * The remaining margin is what keeps neighbours apart: at 0.72 there is always
 * at least 28% of a cell between two icons, so they cannot collide, and the
 * roaming is wide enough that the underlying grid is not visible.
 */
const CELL_JITTER = 0.72;

/**
 * The share of the page kept clear for content, as a fraction of each axis.
 *
 * Every screen in this app centres what matters — the wordmark and buttons on
 * the landing page, a card on the forms — and an icon behind a heading is
 * texture competing with the thing it is meant to sit behind. Held to less
 * than half of each axis so the icons still read as covering the page rather
 * than hugging its frame.
 */
const CLEAR_X = 0.46;
const CLEAR_Y = 0.48;

/**
 * Extra clearance in pixels, on top of the cleared area.
 *
 * An icon is not still — it traces an ellipse of up to 8.6px (the largest
 * band amplitude, `hypot(5, 7)`). Pushing it to exactly the boundary means its
 * own drift carries it back inside on every cycle. Expressing the clearance as
 * a ratio failed for the same reason: 6% of a wide screen is generous, but 6%
 * of a narrow one is smaller than the drift it has to survive.
 */
const CLEAR_PAD = 12;

/**
 * Moves an icon out of the middle of the page.
 *
 * The keep-out is an ellipse rather than a rectangle because content is
 * centred and roughly oval in mass; a rectangle would push icons into hard
 * lines along its sides, which is more visible than the clustering it fixes.
 *
 * An icon inside it is pushed straight out along the line from the centre, so
 * it keeps the direction its cell gave it and the ring stays as evenly spread
 * as the grid underneath was.
 */
function clearOfCentre(
  x: number,
  y: number,
  size: number,
  width: number,
  height: number,
  seed: number,
): { x: number; y: number } {
  const centreX = width / 2;
  const centreY = height / 2;
  // The content area plus enough clearance that drift cannot reach back in.
  const radiusX = (width * CLEAR_X) / 2 + CLEAR_PAD;
  const radiusY = (height * CLEAR_Y) / 2 + CLEAR_PAD;

  // Measured from the icon's middle, not its corner.
  const iconX = x + size / 2;
  const iconY = y + size / 2;

  const normX = (iconX - centreX) / radiusX;
  const normY = (iconY - centreY) / radiusY;
  const distance = Math.hypot(normX, normY);

  if (distance >= 1) return { x, y };

  // Dead centre has no direction to push along, so take one from the hash
  // rather than leaving the icon where it is.
  if (distance < 0.001) {
    const angle = hash(seed * 13 + 29) * Math.PI * 2;
    return {
      x: centreX + Math.cos(angle) * radiusX - size / 2,
      y: centreY + Math.sin(angle) * radiusY - size / 2,
    };
  }

  const push = 1 / distance;
  return {
    x: centreX + (iconX - centreX) * push - size / 2,
    y: centreY + (iconY - centreY) * push - size / 2,
  };
}

/**
 * Scatters icons evenly across the page.
 *
 * This started as rejection sampling — propose a random point, reject it if it
 * lands too close to one already placed. That reliably avoided collisions but
 * not gaps: on a phone, which only carries eight or ten icons, it repeatedly
 * left an entire ninth of the screen empty, which is the opposite of what a
 * full-page texture is for.
 *
 * Stratified placement fixes the coverage directly. The page is divided into
 * one cell per icon and each icon is placed at a random point *within its own
 * cell*, so every region gets one by construction and no loop can fail. The
 * jitter inside the cell is what stops it reading as the grid it technically
 * is.
 */
function scatter(width: number, height: number): Doodle[] {
  // The first render on web can report a zero viewport. Without this the
  // aspect ratio is 0/0, every derived count is NaN, and the loops below
  // silently do nothing — the same empty result, but reached by accident.
  if (width <= 0 || height <= 0) return [];

  const area = width * height;
  const target = Math.max(
    MIN_ICONS,
    Math.min(MAX_ICONS, Math.round(area / AREA_PER_ICON)),
  );

  // Rows come from the aspect ratio and columns follow, which keeps cells
  // roughly square instead of the tall slivers a phone would otherwise get.
  //
  // Three of each is the floor. Two columns cannot cover a screen: measured in
  // thirds, a two-column layout leaves the middle third empty unless jitter
  // happens to reach it, and on a phone it repeatedly did not.
  const rows = Math.max(3, Math.round(Math.sqrt(target * (height / width))));
  const columns = Math.max(3, Math.round(target / rows));

  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const out: Doodle[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = row * columns + column;

      const sizeMix = hash(i * 7 + 11);
      const size = Math.round(MIN_SIZE + sizeMix * (MAX_SIZE - MIN_SIZE));

      // Centre the roaming area, then place randomly inside it.
      const roamX = Math.max(0, cellWidth * CELL_JITTER - size);
      const roamY = Math.max(0, cellHeight * CELL_JITTER - size);
      const originX = column * cellWidth + (cellWidth - roamX - size) / 2;
      const originY = row * cellHeight + (cellHeight - roamY - size) / 2;

      const placed = clearOfCentre(
        originX + hash(i * 2 + 1) * roamX,
        originY + hash(i * 2 + 2) * roamY,
        size,
        width,
        height,
        i,
      );

      out.push({
        key: `d${i}`,
        icon: SHUFFLED[i % SHUFFLED.length] ?? '💼',
        // Clamped so an icon in an edge cell cannot hang off the page.
        left: Math.min(width - size, Math.max(0, placed.x)),
        top: Math.min(height - size, Math.max(0, placed.y)),
        size,
        rotate: `${Math.round(hash(i * 5 + 3) * 20 - 10)}deg`,
        // 0.7 at the smallest, 1 at the largest.
        //
        // This multiplies the theme's `doodleOpacity`, it does not replace it,
        // so the floor cannot go much lower: at 0.55 the smallest icons landed
        // at an effective 0.12, which measures under 1.15:1 against the page
        // and is the invisibility the whole layer was suffering from.
        depth: 0.8 + sizeMix * 0.2,
        // Down the diagonal rather than the flat index: with a fixed column
        // count, `i % 4` puts every fourth icon in the same band straight down
        // a column, and the eye picks that out at once.
        band: (row + column) % BANDS.length,
        phase: hash(i * 11 + 17),
      });
    }
  }

  return out;
}

/**
 * The scattered icons behind every screen, each drifting on its own.
 *
 * Two motions are layered. The whole sheet rises and falls very slowly, which
 * reads as depth. On top of that every icon traces a small ellipse.
 *
 * The icons share four drivers rather than owning one each. Drivers are the
 * expensive part — each is a running animation the platform has to tick — and
 * on the cheap Android handsets this app targets, twenty of them for a
 * decoration nobody should consciously notice is a real cost. Interpolations
 * are nearly free, so each icon reads its band's driver at *its own phase*
 * instead: same clock, different point on the circle. Neighbours in a band
 * therefore never move in lockstep, which is what made the old version read as
 * the whole page tilting rather than as icons floating.
 */
const BANDS = [
  { duration: 15000, x: 5, y: 7 },
  { duration: 19000, x: -7, y: 4 },
  { duration: 23000, x: 4, y: -6 },
  { duration: 27000, x: -5, y: -5 },
];

/**
 * Points sampled around each ellipse.
 *
 * `interpolate` walks straight lines between the values it is given, so four
 * points would trace a diamond. Eight is enough that the corners stop reading
 * as corners.
 */
const STEPS = 8;
const PATH_INPUT = Array.from({ length: STEPS + 1 }, (_, k) => k / STEPS);

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

  const { width, height } = useWindowDimensions();
  const doodles = useMemo(() => scatter(width, height), [width, height]);

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
          doodles={doodles.filter((d) => d.band === i)}
        />
      ))}
    </Animated.View>
  );
}

/**
 * One band: a single driver, read by each of its icons at a different phase.
 *
 * The ellipse is a real sine and cosine sampled at `STEPS` points rather than
 * the quarter-point trick used before. Sampling from the icon's own phase and
 * going all the way round means the last value equals the first, so the loop
 * closes without a visible seam.
 */
function WanderBand({
  band,
  doodles,
}: {
  band: (typeof BANDS)[number];
  doodles: Doodle[];
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

  return (
    <>
      {doodles.map((doodle) => {
        const outX = PATH_INPUT.map(
          (k) =>
            Math.round(
              band.x * Math.sin(2 * Math.PI * (k + doodle.phase)) * 100,
            ) / 100,
        );
        const outY = PATH_INPUT.map(
          (k) =>
            Math.round(
              band.y * Math.cos(2 * Math.PI * (k + doodle.phase)) * 100,
            ) / 100,
        );

        return (
          <Animated.Text
            key={doodle.key}
            style={{
              position: 'absolute',
              top: doodle.top,
              left: doodle.left,
              fontSize: doodle.size,
              opacity: doodle.depth,
              transform: [
                {
                  translateX: wander.interpolate({
                    inputRange: PATH_INPUT,
                    outputRange: outX,
                  }),
                },
                {
                  translateY: wander.interpolate({
                    inputRange: PATH_INPUT,
                    outputRange: outY,
                  }),
                },
                { rotate: doodle.rotate },
              ],
            }}
          >
            {doodle.icon}
          </Animated.Text>
        );
      })}
    </>
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
