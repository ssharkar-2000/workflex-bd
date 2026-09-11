import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { JOB_CATEGORIES, jobCategoryName } from '@workflex/shared';
import { BrandName } from './BrandName';
import { useLocale, useT, type TranslationKey } from '../i18n';
import { useTheme } from '../lib/use-theme';

/**
 * The ten seconds before the landing page: one person, both sides of the
 * marketplace.
 *
 * An animated character searches for part-time work on their phone and gets
 * the notification that they are hired — then, with a tap leaking at home,
 * turns recruiter: posts a job for a plumber, has the best one picked by CV
 * match, and shakes his hand when he arrives. The badge over their head says
 * it outright: job seeker, then recruiter, then both. That is the product's
 * differentiator, told as a story rather than a claim.
 *
 * The people are drawn from plain shapes, each limb its own view hinged at
 * the joint, so a pose is a handful of angles and the whole cast animates on
 * the native driver. What they see on their phone pops up above them as the
 * app's own cards — a job search, a push notification, the posting form, a
 * CV match — in the theme's colours and the reader's language.
 *
 * Everything hangs off one clock running from 0 to `BEAT.end`. Each element
 * reads the part of the storyboard it belongs to, so the piece stays in step
 * by construction, and a beat is retimed by changing its number in `BEAT`.
 */

/** The storyboard in milliseconds. */
const BEAT = {
  appear: 0, // the character steps into view, phone in hand
  search: 450, // a job search pops up from the phone
  results: 1000, // part-time jobs come back
  notify: 2000, // WorkFlex BD: you're hired
  cheer: 2250, // arms up, a jump, confetti
  think: 3500, // a tap leaking at home; the badge turns recruiter
  post: 4700, // the plumber job is typed and posted
  match: 6000, // applicants' CVs are compared; the best one is hired
  arrive: 7300, // the plumber walks in
  shake: 7950, // they shake hands
  words: 8400, // Find work. Find workers.
  end: 9400,
} as const;

/** Every tap on a card, so a button and its press land together. */
const PRESS = {
  submit: BEAT.post + 900,
  hire: BEAT.match + 1050,
} as const;

/** A press: down in 70 ms, back up by 200. */
const pressTimes = (at: number) => [at, at + 70, at + 200];

/** When each field is typed into. */
const TYPE = {
  search: { from: BEAT.search + 80, until: BEAT.search + 480 },
  title: { from: BEAT.post + 150, until: BEAT.post + 600 },
} as const;
const CHIP_AT = BEAT.post + 650;
const BUDGET_AT = BEAT.post + 750;

/**
 * The stage is laid out once at this size and scaled to fit the screen, so
 * every position below is a plain number rather than a share of the window.
 */
const STAGE_W = 320;
const STAGE_H = 600;
/** Height of the progress-and-Skip bar, below the safe-area inset. */
const BAR = 52;

const CAPTION_TOP = 22;
/** The closing words sit in the space the cards have left, near the cast. */
const WORDS_TOP = 110;
/** Bangla stacks marks above its letters, so the two lines need room between them. */
const WORDS_GAP = 40;
/** The cards the character's phone shows, popped up above their head. */
const CARD = { left: 20, top: 70, width: 280 };
/** The role badge, just above the character's hair. */
const BADGE_TOP = 262;
const GLOW = 440;

/**
 * A person, drawn in a 200 × 310 box: every part is placed from these.
 * Arms are two segments hinged at the shoulder and elbow; legs hinge at the
 * hip. An angle of zero is a limb hanging straight down.
 */
const FIG = { width: 200, height: 310 };
const ARM_W = 20;
const UPPER = 48;
const FORE = 44;
const SHOULDER = { left: { x: 66, y: 100 }, right: { x: 134, y: 100 } };

/**
 * The hero's arm poses: the upper arm's angle at the shoulder (`u`) and the
 * forearm's at the elbow (`f`). Each is solved from the shoulders and arm
 * lengths above, so the hand lands where the story needs it — on the phone,
 * in their hair, in the plumber's hand.
 */
const POSE = {
  // Left arm
  rest: { u: 8, f: -4 },
  tap: { u: 13, f: -128 }, // hand on the phone's screen
  cheerLeft: { u: 150, f: 15 },
  scratch: { u: 137, f: 98 }, // scratching the side of their head
  // Right arm
  read: { u: -22, f: 131 }, // phone held up at the chest
  cheerRight: { u: -150, f: -15 },
  lowered: { u: -8, f: 30 },
  shake: { u: -15, f: -25 }, // meets the plumber's hand
} as const;

/** The phone is turned in the hand so it stands upright in the reading pose. */
const PHONE_TILT = -(POSE.read.u + POSE.read.f);

/** Where each person stands. The plumber walks in from off the right edge. */
const HERO_AT = { left: 60, top: 278 };
const PLUMBER_AT = { left: 150, top: 278 };
/** How far the hero steps left to make room, and where the plumber starts. */
const HERO_STEP = -60;
const PLUMBER_FROM = 230;

/**
 * The cast's colours — people and things, not interface, so they are the
 * same in either theme. The hero wears the brand's warm accent; the plumber
 * is in work blue with a yellow cap.
 */
type Look = {
  skin: string;
  skinShade: string;
  hair: string;
  shirt: string;
  shirtShade: string;
  sleeve: number;
  pants: string;
  shoe: string;
  sole: string;
  overall?: string;
  cap?: string;
  mustache?: boolean;
};

const HERO: Look = {
  skin: '#C98A5E',
  skinShade: '#AE7049',
  hair: '#231B17',
  shirt: '#F0884C',
  shirtShade: '#D56E35',
  sleeve: 26,
  pants: '#2F3552',
  shoe: '#F4F4F6',
  sole: '#BFC3CE',
};

const PLUMBER: Look = {
  skin: '#9F6A45',
  skinShade: '#83553A',
  hair: '#1D1714',
  shirt: '#D9DCE4',
  shirtShade: '#BCC1CD',
  sleeve: UPPER + ARM_W,
  pants: '#2F6FB5',
  shoe: '#4A3324',
  sole: '#2B1D14',
  overall: '#2F6FB5',
  cap: '#F2B233',
  mustache: true,
};

/** The app icon on the notification: the same on every phone. */
const ICON = ['#3A34A0', '#6D28D9'] as const;
const CONFETTI = ['#3A34A0', '#6D28D9', '#136B3A', '#F0884C', '#F2B233'];
const WATER = '#4AA3E0';

const JOBS = [
  { initials: 'GM', title: 'intro.job1.title', where: 'intro.job1.where', pay: 600 },
  { initials: 'SP', title: 'intro.job2.title', where: 'intro.job2.where', pay: 700 },
] as const;

const CANDIDATES = [
  { initials: 'KM', name: 'intro.cand1.name', meta: 'intro.cand1.meta', score: 96 },
  { initials: 'JH', name: 'intro.cand2.name', meta: 'intro.cand2.meta', score: 88 },
  { initials: 'SR', name: 'intro.cand3.name', meta: 'intro.cand3.meta', score: 79 },
] as const;

/** The real category a plumber is posted under. */
const TRADES_EMOJI =
  JOB_CATEGORIES.find((cat) => cat.key === 'TRADES')?.emoji ?? '🔧';

/** One line above the scene per part of the story. */
const CAPTIONS: { key: TranslationKey; from: number; until: number }[] = [
  { key: 'intro.cap.search', from: BEAT.appear + 150, until: BEAT.notify - 50 },
  { key: 'intro.cap.hired', from: BEAT.notify + 150, until: BEAT.think - 50 },
  { key: 'intro.cap.needHelp', from: BEAT.think + 100, until: BEAT.post - 50 },
  { key: 'intro.cap.post', from: BEAT.post + 100, until: BEAT.match - 50 },
  { key: 'intro.cap.matched', from: BEAT.match + 100, until: BEAT.arrive - 50 },
  { key: 'intro.cap.arrive', from: BEAT.arrive + 100, until: BEAT.words - 100 },
];

type Ease = (value: number) => number;

const easeOut: Ease = Easing.out(Easing.cubic);
const easeIn: Ease = Easing.in(Easing.cubic);
const easeInOut: Ease = Easing.inOut(Easing.cubic);
/** Overshoots a touch and settles — for things that pop into place. */
const pop: Ease = Easing.out(Easing.back(2));

/** Samples per eased stretch: enough that the joins between them never show. */
const SAMPLES = 10;

/**
 * Keyframes with the easing baked in as short straight steps.
 *
 * `interpolate` accepts an `easing` of its own, but only in JavaScript. The
 * native driver's interpolation node draws straight lines between keyframes
 * and nothing else — React Native reports `easing` as unsupported there and
 * leaves it behind. Handed to `interpolate`, every curve here would work in
 * the browser, where these run in JavaScript, and come out linear on a phone,
 * with an error logged in development. Sampled here, it is the same curve on
 * both.
 */
function keyframes(
  times: readonly number[],
  values: readonly number[],
  ease: Ease,
) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const start = times[i]!;
    const end = times[i + 1]!;
    const from = values[i]!;
    const to = values[i + 1]!;
    // A hold, or a jump made while the element is hidden, is already straight.
    const steps = from === to || end - start <= 1 ? 1 : SAMPLES;
    for (let k = 0; k < steps; k++) {
      inputRange.push(start + ((end - start) * k) / steps);
      outputRange.push(from + (to - from) * ease(k / steps));
    }
  }
  inputRange.push(times[times.length - 1]!);
  outputRange.push(values[values.length - 1]!);
  return { inputRange, outputRange };
}

/** One element's track on the clock, held still outside its first and last keyframes. */
function track(
  clock: Animated.Value,
  times: readonly number[],
  values: readonly number[],
  ease: Ease = easeOut,
) {
  return clock.interpolate({
    ...keyframes(times, values, ease),
    extrapolate: 'clamp',
  });
}

/** The same, for a rotation in degrees. */
function turn(
  clock: Animated.Value,
  times: readonly number[],
  degrees: readonly number[],
  ease: Ease = easeInOut,
) {
  const { inputRange, outputRange } = keyframes(times, degrees, ease);
  return clock.interpolate({
    inputRange,
    outputRange: outputRange.map((deg) => `${deg}deg`),
    extrapolate: 'clamp',
  });
}

/** Fades something in over `[from, from + fade]` and out over `[until - fade, until]`. */
function shown(clock: Animated.Value, from: number, until: number, fade = 200) {
  return track(clock, [from, from + fade, until - fade, until], [0, 1, 1, 0]);
}

type Clocked = { clock: Animated.Value };

export function TwoRolesIntro({ onEnd }: { onEnd: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const clock = useRef(new Animated.Value(0)).current;

  // Held in a ref, so a parent passing a fresh callback on every render
  // cannot restart the clock by changing the effect's dependencies.
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  // Ends once, whichever comes first: the clock running out, Skip, or the
  // reduce-motion setting.
  const ended = useRef(false);
  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    clock.stopAnimation();
    onEndRef.current();
  }, [clock]);

  useEffect(() => {
    let alive = true;
    const run = Animated.timing(clock, {
      toValue: BEAT.end,
      duration: BEAT.end,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    // Ten seconds of motion is exactly what the reduce-motion setting asks to
    // be spared, so for those readers the landing page comes straight up.
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!alive) return;
      if (reduce) {
        finish();
        return;
      }
      run.start(({ finished }) => {
        if (finished) finish();
      });
    });

    return () => {
      alive = false;
      run.stop();
    };
  }, [clock, finish]);

  const progress = useMemo(
    () => track(clock, [0, BEAT.end], [0.001, 1], Easing.linear),
    [clock],
  );

  // Fit the stage into what the bar leaves: never so small that the words
  // stop being readable, never blown up to fill a desktop monitor.
  const scale = Math.max(
    0.6,
    Math.min(
      1.25,
      (width - 32) / STAGE_W,
      (height - insets.top - BAR - insets.bottom - 24) / STAGE_H,
    ),
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: c.primary, transform: [{ scaleX: progress }] },
            ]}
          />
        </View>
        <Pressable
          onPress={finish}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('intro.skipLabel')}
          style={({ pressed }) => [
            styles.skip,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.skipText, { color: c.text }]}>
            {t('intro.skip')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.stageArea}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('intro.a11y')}
          style={[styles.stage, { transform: [{ scale }] }]}
        >
          <Backdrop />
          <Captions clock={clock} />
          <Floor clock={clock} />
          <Plumber clock={clock} />
          <Hero clock={clock} />
          <Confetti clock={clock} />
          <Spark clock={clock} />
          <Badges clock={clock} />
          <ThoughtBubble clock={clock} />
          <SearchCard clock={clock} />
          <NotifyCard clock={clock} />
          <PostCard clock={clock} />
          <MatchCard clock={clock} />
        </View>
      </View>
    </View>
  );
}

/** A soft pool of the brand colour behind the cast, so the stage is not flat. */
function Backdrop() {
  const { c } = useTheme();
  return (
    <Svg width={GLOW} height={GLOW} style={styles.backdrop}>
      <Defs>
        <RadialGradient id="intro-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.primarySoft} stopOpacity="1" />
          <Stop offset="1" stopColor={c.primarySoft} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle
        cx={GLOW / 2}
        cy={GLOW / 2}
        r={GLOW / 2}
        fill="url(#intro-glow)"
      />
    </Svg>
  );
}

/** The line at the top that says what is happening, then the closing words. */
function Captions({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      lines: CAPTIONS.map((cap) => ({
        opacity: shown(clock, cap.from, cap.until, 250),
        y: track(clock, [cap.from, cap.from + 300], [8, 0]),
      })),
      first: track(clock, [BEAT.words, BEAT.words + 400], [0, 1]),
      firstY: track(clock, [BEAT.words, BEAT.words + 400], [12, 0]),
      second: track(clock, [BEAT.words + 200, BEAT.words + 600], [0, 1]),
      secondY: track(clock, [BEAT.words + 200, BEAT.words + 600], [12, 0]),
    }),
    [clock],
  );

  return (
    <>
      {CAPTIONS.map((cap, i) => (
        <Animated.Text
          key={cap.key}
          numberOfLines={2}
          style={[
            styles.caption,
            {
              color: c.text,
              opacity: m.lines[i]!.opacity,
              transform: [{ translateY: m.lines[i]!.y }],
            },
          ]}
        >
          {t(cap.key)}
        </Animated.Text>
      ))}
      <Animated.Text
        style={[
          styles.words,
          {
            top: WORDS_TOP,
            color: c.text,
            opacity: m.first,
            transform: [{ translateY: m.firstY }],
          },
        ]}
      >
        {t('intro.findWork')}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.words,
          {
            top: WORDS_TOP + WORDS_GAP,
            color: c.primary,
            opacity: m.second,
            transform: [{ translateY: m.secondY }],
          },
        ]}
      >
        {t('intro.findWorkers')}
      </Animated.Text>
    </>
  );
}

/** Soft shadows on the floor, which follow the two people and shrink as the hero jumps. */
function Floor({ clock }: Clocked) {
  const m = useMemo(
    () => ({
      heroX: track(
        clock,
        [BEAT.arrive, BEAT.arrive + 600],
        [0, HERO_STEP],
        easeInOut,
      ),
      heroScale: track(
        clock,
        [
          BEAT.cheer,
          BEAT.cheer + 150,
          BEAT.cheer + 300,
          BEAT.cheer + 450,
          BEAT.cheer + 600,
        ],
        [1, 0.75, 1, 0.88, 1],
      ),
      heroOpacity: track(clock, [0, 300], [0, 1]),
      plumberX: track(clock, [BEAT.arrive, BEAT.arrive + 700], [PLUMBER_FROM, 0]),
      plumberOpacity: track(clock, [BEAT.arrive, BEAT.arrive + 150], [0, 1]),
    }),
    [clock],
  );

  return (
    <>
      <Animated.View
        style={[
          styles.shadow,
          {
            left: HERO_AT.left + 45,
            opacity: m.heroOpacity,
            transform: [{ translateX: m.heroX }, { scaleX: m.heroScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.shadow,
          {
            left: PLUMBER_AT.left + 45,
            opacity: m.plumberOpacity,
            transform: [{ translateX: m.plumberX }],
          },
        ]}
      />
    </>
  );
}

/** Eyes close for a moment at each of these times. */
function blinks(clock: Animated.Value, at: readonly number[]) {
  return track(
    clock,
    at.flatMap((b) => [b - 1, b, b + 80, b + 160]),
    at.flatMap(() => [1, 1, 0.1, 1]),
    Easing.linear,
  );
}

/** A value that never moves, for a limb that holds one pose throughout. */
const still = (clock: Animated.Value, deg: number) =>
  turn(clock, [0, 1], [deg, deg]);

/** One keyframe of a limb: when, and at what angle. */
type Key = readonly [ms: number, deg: number];

/** A rotation track from `[ms, degrees]` keyframes. */
function pose(clock: Animated.Value, keys: readonly Key[]) {
  const times: number[] = [];
  for (const [at] of keys) {
    // Two moves can land on the same millisecond — the end of one press and
    // the start of the next beat. A 1 ms nudge keeps the track in order.
    const last = times[times.length - 1];
    times.push(last === undefined ? at : Math.max(at, last + 1));
  }
  return turn(
    clock,
    times,
    keys.map((key) => key[1]),
  );
}

/** A limb nodding either side of `deg` — a finger typing, a hand shaking. */
function nods(from: number, until: number, deg: number, amp = 6, step = 100) {
  const keys: Key[] = [];
  for (let at = from + step, i = 0; at < until; at += step, i++) {
    keys.push([at, deg + (i % 2 === 0 ? amp : -amp)]);
  }
  return keys;
}

/** A finger pressing a button on the screen. */
const push = (at: number, deg: number): Key[] => [
  [at - 100, deg],
  [at, deg - 10],
  [at + 150, deg],
];

/** The hand holding the phone giving a little under that press. */
const give = (at: number, deg: number): Key[] => [
  [at, deg],
  [at + 70, deg - 6],
  [at + 200, deg],
];

/**
 * The person the story follows: a job seeker at first, then a recruiter.
 * The right hand holds the phone; the left types on it. Negative angles lift
 * the right arm outward, positive the left.
 */
function Hero({ clock }: Clocked) {
  const b = BEAT;
  const m = useMemo(
    () => ({
      opacity: track(clock, [0, 300], [0, 1]),
      // Walks left to make room when the plumber arrives.
      x: track(clock, [b.arrive, b.arrive + 600], [0, HERO_STEP], easeInOut),
      // Steps up into view, jumps twice for joy, bobs as it walks.
      y: track(
        clock,
        [
          0,
          350,
          b.cheer,
          b.cheer + 150,
          b.cheer + 300,
          b.cheer + 450,
          b.cheer + 600,
          b.arrive,
          b.arrive + 150,
          b.arrive + 300,
          b.arrive + 450,
          b.arrive + 600,
        ],
        [30, 0, 0, -18, 0, -9, 0, 0, -3, 0, -3, 0],
      ),
      // Leans towards the phone while using it, and into the scratch.
      head: pose(clock, [
        [0, 0],
        [b.search, -4],
        [b.cheer - 100, -4],
        [b.cheer + 100, 4],
        [b.think - 250, 4],
        [b.think - 50, -4],
        [b.think + 200, -8],
        [b.think + 850, -8],
        [b.think + 1050, -4],
        [b.arrive, -4],
        [b.arrive + 300, 0],
      ]),
      // Right arm: holds the phone up, buzzes with the notification, throws
      // it up in the cheer, gives under each press, then lowers it and
      // reaches out to shake hands.
      rightUpper: pose(clock, [
        [0, POSE.read.u],
        [b.cheer - 100, POSE.read.u],
        [b.cheer + 100, POSE.cheerRight.u],
        [b.think - 250, POSE.cheerRight.u],
        [b.think - 50, POSE.read.u],
        [b.arrive, POSE.read.u],
        [b.arrive + 300, POSE.lowered.u],
        [b.shake, POSE.shake.u],
      ]),
      rightFore: pose(clock, [
        [0, POSE.read.f],
        [b.notify, POSE.read.f],
        ...nods(b.notify, b.cheer - 100, POSE.read.f, 4, 40),
        [b.cheer - 100, POSE.read.f],
        [b.cheer + 100, POSE.cheerRight.f],
        [b.think - 250, POSE.cheerRight.f],
        [b.think - 50, POSE.read.f],
        ...give(PRESS.submit, POSE.read.f),
        ...give(PRESS.hire, POSE.read.f),
        [b.arrive, POSE.read.f],
        [b.arrive + 300, POSE.lowered.f],
        [b.shake, POSE.shake.f],
        ...nods(b.shake, b.shake + 500, POSE.shake.f, -8),
        [b.shake + 500, POSE.shake.f],
      ]),
      // Left arm: types the search, cheers, scratches their head over the
      // leak, types the job out and posts it, then presses Hire.
      leftUpper: pose(clock, [
        [0, POSE.rest.u],
        [TYPE.search.from - 80, POSE.rest.u],
        [TYPE.search.from + 20, POSE.tap.u],
        [TYPE.search.until + 70, POSE.tap.u],
        [TYPE.search.until + 270, POSE.rest.u],
        [b.cheer - 100, POSE.rest.u],
        [b.cheer + 100, POSE.cheerLeft.u],
        [b.think - 250, POSE.cheerLeft.u],
        [b.think - 50, POSE.rest.u],
        [b.think + 200, POSE.scratch.u],
        [b.think + 850, POSE.scratch.u],
        [b.think + 1050, POSE.rest.u],
        [b.post + 50, POSE.tap.u],
        [PRESS.submit + 150, POSE.tap.u],
        [PRESS.submit + 350, POSE.rest.u],
        [PRESS.hire - 250, POSE.rest.u],
        [PRESS.hire - 100, POSE.tap.u],
        [PRESS.hire + 150, POSE.tap.u],
        [PRESS.hire + 350, POSE.rest.u],
      ]),
      leftFore: pose(clock, [
        [0, POSE.rest.f],
        [TYPE.search.from - 80, POSE.rest.f],
        [TYPE.search.from + 20, POSE.tap.f],
        ...nods(TYPE.search.from + 20, TYPE.search.until, POSE.tap.f),
        [TYPE.search.until + 70, POSE.tap.f],
        [TYPE.search.until + 270, POSE.rest.f],
        [b.cheer - 100, POSE.rest.f],
        [b.cheer + 100, POSE.cheerLeft.f],
        [b.think - 250, POSE.cheerLeft.f],
        [b.think - 50, POSE.rest.f],
        [b.think + 200, POSE.scratch.f],
        ...nods(b.think + 200, b.think + 850, POSE.scratch.f, 10),
        [b.think + 850, POSE.scratch.f],
        [b.think + 1050, POSE.rest.f],
        [b.post + 50, POSE.tap.f],
        ...nods(b.post + 50, PRESS.submit - 100, POSE.tap.f),
        ...push(PRESS.submit, POSE.tap.f),
        [PRESS.submit + 350, POSE.rest.f],
        [PRESS.hire - 250, POSE.rest.f],
        [PRESS.hire - 100, POSE.tap.f],
        ...push(PRESS.hire, POSE.tap.f),
        [PRESS.hire + 350, POSE.rest.f],
      ]),
      leftLeg: turn(
        clock,
        [b.arrive, b.arrive + 150, b.arrive + 300, b.arrive + 450, b.arrive + 600],
        [0, 14, -14, 14, 0],
      ),
      rightLeg: turn(
        clock,
        [b.arrive, b.arrive + 150, b.arrive + 300, b.arrive + 450, b.arrive + 600],
        [0, -14, 14, -14, 0],
      ),
      blink: blinks(clock, [1500, 4250, 6600, 8900]),
      brow: track(
        clock,
        [b.notify, b.notify + 100, b.notify + 1100, b.notify + 1300],
        [0, -3, -3, 0],
      ),
      grin: track(
        clock,
        [2150, 2250, 3300, 3450, b.shake, b.shake + 150],
        [0, 1, 1, 0, 0, 1],
      ),
      phone: track(clock, [7400, 7600], [1, 0]),
    }),
    [clock, b],
  );
  const smile = useMemo(
    () => Animated.subtract(1, m.grin) as unknown as Animated.AnimatedInterpolation<number>,
    [m.grin],
  );

  return (
    <Figure
      look={HERO}
      at={HERO_AT}
      rig={{ ...m, smile }}
      rightHand={
        // Its back is what faces us: the screen faces the person holding it.
        <Animated.View style={[styles.heldPhone, { opacity: m.phone }]}>
          <View style={styles.phoneCamera} />
        </Animated.View>
      }
    />
  );
}

/** The plumber the CV match found: walks in with his toolbox and shakes hands. */
function Plumber({ clock }: Clocked) {
  const b = BEAT;
  const m = useMemo(() => {
    const walk = [
      b.arrive,
      b.arrive + 175,
      b.arrive + 350,
      b.arrive + 525,
      b.arrive + 700,
    ];
    return {
      opacity: track(clock, [b.arrive, b.arrive + 150], [0, 1]),
      x: track(clock, [b.arrive, b.arrive + 700], [PLUMBER_FROM, 0]),
      y: track(clock, walk, [0, -3, 0, -3, 0]),
      head: turn(clock, [b.shake, b.shake + 150, b.shake + 300], [0, 5, 0]),
      // Left arm reaches for the hero's hand; the right carries the toolbox.
      leftUpper: turn(clock, [0, b.shake - 250, b.shake], [6, 6, 15]),
      leftFore: turn(
        clock,
        [
          0,
          b.shake - 250,
          b.shake,
          b.shake + 100,
          b.shake + 200,
          b.shake + 300,
          b.shake + 400,
          b.shake + 500,
        ],
        [-8, -8, 25, 33, 17, 33, 17, 25],
      ),
      rightUpper: still(clock, -4),
      rightFore: still(clock, 4),
      leftLeg: turn(clock, walk, [0, 14, -14, 14, 0]),
      rightLeg: turn(clock, walk, [0, -14, 14, -14, 0]),
      blink: blinks(clock, [8700]),
      brow: track(clock, [0, 1], [0, 0]),
      grin: track(clock, [b.shake, b.shake + 150], [0, 1]),
    };
  }, [clock, b]);
  const smile = useMemo(
    () => Animated.subtract(1, m.grin) as unknown as Animated.AnimatedInterpolation<number>,
    [m.grin],
  );

  return (
    <Figure
      look={PLUMBER}
      at={PLUMBER_AT}
      rig={{ ...m, smile }}
      rightHand={
        <View style={styles.toolbox}>
          <View style={styles.toolboxHandle} />
          <View style={styles.toolboxLid} />
        </View>
      }
    />
  );
}

type Motion = Animated.AnimatedInterpolation<number>;
type Angle = Animated.AnimatedInterpolation<string>;

type Rig = {
  opacity: Motion;
  x: Motion;
  y: Motion;
  head: Angle;
  leftUpper: Angle;
  leftFore: Angle;
  rightUpper: Angle;
  rightFore: Angle;
  leftLeg: Angle;
  rightLeg: Angle;
  blink: Motion;
  brow: Motion;
  grin: Motion;
  smile: Motion;
};

/**
 * A person, from plain shapes. Each limb is its own view hinged at the joint
 * — the forearm lives inside the upper arm, so it swings with it — which keeps
 * every movement a rotation the native driver can run.
 */
function Figure({
  look,
  rig,
  at,
  rightHand,
}: {
  look: Look;
  rig: Rig;
  at: { left: number; top: number };
  rightHand?: React.ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.figure,
        {
          left: at.left,
          top: at.top,
          opacity: rig.opacity,
          transform: [{ translateX: rig.x }, { translateY: rig.y }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.leg,
          styles.legLeft,
          { backgroundColor: look.pants, transform: [{ rotate: rig.leftLeg }] },
        ]}
      >
        <View
          style={[
            styles.shoe,
            styles.shoeLeft,
            { backgroundColor: look.shoe, borderBottomColor: look.sole },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.leg,
          styles.legRight,
          { backgroundColor: look.pants, transform: [{ rotate: rig.rightLeg }] },
        ]}
      >
        <View
          style={[
            styles.shoe,
            styles.shoeRight,
            { backgroundColor: look.shoe, borderBottomColor: look.sole },
          ]}
        />
      </Animated.View>
      <View style={[styles.hips, { backgroundColor: look.pants }]} />

      <View style={[styles.neck, { backgroundColor: look.skinShade }]} />
      <View style={[styles.torso, { backgroundColor: look.shirt }]}>
        <View style={[styles.torsoShade, { backgroundColor: look.shirtShade }]} />
        {look.overall ? (
          <>
            <View style={[styles.bib, { backgroundColor: look.overall }]} />
            <View
              style={[styles.strap, styles.strapLeft, { backgroundColor: look.overall }]}
            />
            <View
              style={[styles.strap, styles.strapRight, { backgroundColor: look.overall }]}
            />
          </>
        ) : null}
        <View style={[styles.neckline, { backgroundColor: look.skinShade }]} />
      </View>

      <Animated.View style={[styles.head, { transform: [{ rotate: rig.head }] }]}>
        <View style={[styles.ear, styles.earLeft, { backgroundColor: look.skinShade }]} />
        <View style={[styles.ear, styles.earRight, { backgroundColor: look.skinShade }]} />
        <View style={[styles.face, { backgroundColor: look.skin }]} />
        {look.cap ? (
          <>
            <View style={[styles.capCrown, { backgroundColor: look.cap }]} />
            <View style={[styles.capBrim, { backgroundColor: look.cap }]} />
          </>
        ) : (
          <>
            <View style={[styles.hair, { backgroundColor: look.hair }]} />
            <View style={[styles.fringe, { backgroundColor: look.hair }]} />
          </>
        )}
        <Animated.View style={[styles.brows, { transform: [{ translateY: rig.brow }] }]}>
          <View style={[styles.brow, { backgroundColor: look.hair }]} />
          <View style={[styles.brow, { backgroundColor: look.hair }]} />
        </Animated.View>
        <Animated.View style={[styles.eyes, { transform: [{ scaleY: rig.blink }] }]}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </Animated.View>
        <View style={[styles.cheek, styles.cheekLeft]} />
        <View style={[styles.cheek, styles.cheekRight]} />
        {look.mustache ? (
          <View style={[styles.mustache, { backgroundColor: look.hair }]} />
        ) : null}
        <Animated.View style={[styles.smile, { opacity: rig.smile }]} />
        <Animated.View style={[styles.grin, { opacity: rig.grin }]} />
      </Animated.View>

      <Arm
        look={look}
        shoulder={SHOULDER.left}
        upper={rig.leftUpper}
        fore={rig.leftFore}
      />
      <Arm
        look={look}
        shoulder={SHOULDER.right}
        upper={rig.rightUpper}
        fore={rig.rightFore}
      >
        {rightHand}
      </Arm>
    </Animated.View>
  );
}

/**
 * Upper arm hinged at the shoulder, forearm hinged at the elbow inside it.
 * What the hand carries is drawn before the hand, so the fingers close over
 * it rather than disappearing behind it.
 */
function Arm({
  look,
  shoulder,
  upper,
  fore,
  children,
}: {
  look: Look;
  shoulder: { x: number; y: number };
  upper: Angle;
  fore: Angle;
  children?: React.ReactNode;
}) {
  return (
    <Animated.View
      style={[
        styles.upperArm,
        {
          left: shoulder.x - ARM_W / 2,
          top: shoulder.y - ARM_W / 2,
          backgroundColor: look.skin,
          transform: [{ rotate: upper }],
        },
      ]}
    >
      <View
        style={[styles.sleeve, { height: look.sleeve, backgroundColor: look.shirt }]}
      />
      <Animated.View
        style={[
          styles.forearm,
          { backgroundColor: look.skin, transform: [{ rotate: fore }] },
        ]}
      >
        {children}
        <View style={[styles.hand, { backgroundColor: look.skin }]} />
      </Animated.View>
    </Animated.View>
  );
}

/** A repeatable scatter: the same confetti every time, still looking thrown. */
const scatter = (i: number, n: number) => {
  const x = Math.sin((i + 1) * 12.9898 * n) * 43758.5453;
  return x - Math.floor(x);
};

const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => ({
  color: CONFETTI[i % CONFETTI.length]!,
  dx: (scatter(i, 1) - 0.5) * 240,
  peak: -70 - scatter(i, 2) * 80,
  fall: 60 + scatter(i, 3) * 90,
  spin: (scatter(i, 4) - 0.5) * 720,
  width: 6 + Math.round(scatter(i, 5) * 4),
  height: 9 + Math.round(scatter(i, 6) * 5),
  delay: Math.round(scatter(i, 7) * 120),
}));

/** Thrown up over the hero's head when the job comes through. */
function Confetti({ clock }: Clocked) {
  const pieces = useMemo(
    () =>
      CONFETTI_PIECES.map((p) => {
        const from = BEAT.cheer + p.delay;
        return {
          ...p,
          x: track(clock, [from, from + 1100], [0, p.dx]),
          y: track(clock, [from, from + 380, from + 1100], [0, p.peak, p.fall]),
          spin: turn(clock, [from, from + 1100], [0, p.spin], Easing.linear),
          opacity: track(
            clock,
            [from - 1, from, from + 900, from + 1100],
            [0, 1, 1, 0],
          ),
        };
      }),
    [clock],
  );

  return (
    <>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.confetti,
            {
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.spin },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

/** Where the two hands meet, in stage coordinates. */
const HANDSHAKE = { x: 175, y: HERO_AT.top + 180 };

/** A small burst where the two hands meet. */
function Spark({ clock }: Clocked) {
  const { c } = useTheme();
  const m = useMemo(() => {
    const from = BEAT.shake + 150;
    return {
      out: track(clock, [from, from + 450], [-8, -22]),
      opacity: track(clock, [from - 1, from, from + 350, from + 550], [0, 1, 1, 0]),
    };
  }, [clock]);

  return (
    <>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <Animated.View
          key={deg}
          pointerEvents="none"
          style={[
            styles.ray,
            {
              backgroundColor: c.warning,
              opacity: m.opacity,
              transform: [{ rotate: `${deg}deg` }, { translateY: m.out }],
            },
          ]}
        />
      ))}
    </>
  );
}

/**
 * The badge over the hero's head: job seeker, then — flipping over like the
 * account switching roles — recruiter. At the end the job seeker badge comes
 * back above it: the same person is both.
 */
function Badges({ clock }: Clocked) {
  const flip = BEAT.think + 150;
  const m = useMemo(
    () => ({
      x: track(clock, [BEAT.arrive, BEAT.arrive + 600], [0, HERO_STEP], easeInOut),
      // Rides the hero's two jumps, so their hair never pokes through it.
      y: track(
        clock,
        [
          BEAT.cheer,
          BEAT.cheer + 150,
          BEAT.cheer + 300,
          BEAT.cheer + 450,
          BEAT.cheer + 600,
        ],
        [0, -18, 0, -9, 0],
      ),
      seeker: track(clock, [250, 450, flip, flip + 1], [0, 1, 1, 0]),
      seekerTurn: turn(clock, [flip - 250, flip], [0, 90], easeIn),
      recruiter: track(clock, [flip, flip + 1], [0, 1]),
      recruiterTurn: turn(clock, [flip, flip + 250], [-90, 0], easeOut),
      both: track(clock, [BEAT.words, BEAT.words + 250], [0, 1]),
      bothScale: track(clock, [BEAT.words, BEAT.words + 350], [0.6, 1], pop),
    }),
    [clock, flip],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.badges,
        { transform: [{ translateX: m.x }, { translateY: m.y }] },
      ]}
    >
      <Animated.View
        style={[
          styles.badgeSlot,
          {
            opacity: m.seeker,
            transform: [{ perspective: 400 }, { rotateX: m.seekerTurn }],
          },
        ]}
      >
        <RolePill role="seeker" />
      </Animated.View>
      <Animated.View
        style={[
          styles.badgeSlot,
          {
            opacity: m.recruiter,
            transform: [{ perspective: 400 }, { rotateX: m.recruiterTurn }],
          },
        ]}
      >
        <RolePill role="recruiter" />
      </Animated.View>
      <Animated.View
        style={[
          styles.badgeSlot,
          styles.badgeAbove,
          { opacity: m.both, transform: [{ scale: m.bothScale }] },
        ]}
      >
        <RolePill role="seeker" />
      </Animated.View>
    </Animated.View>
  );
}

/** One role, in the tint the landing page gives it. */
function RolePill({ role }: { role: 'seeker' | 'recruiter' }) {
  const t = useT();
  const { c } = useTheme();
  const tint = role === 'seeker' ? 1 : 0;
  return (
    <View
      style={[
        styles.role,
        { backgroundColor: c.tints[tint], borderColor: c.tintBorders[tint] },
      ]}
    >
      <Text style={[styles.roleText, { color: c.text }]}>
        {role === 'seeker'
          ? `🔍  ${t('intro.role.seeker')}`
          : `📢  ${t('intro.role.recruiter')}`}
      </Text>
    </View>
  );
}

/** Drops falling from the tap, one every `period` ms, offset by `offset`. */
function drip(
  clock: Animated.Value,
  from: number,
  until: number,
  offset: number,
  period = 600,
) {
  const times: number[] = [];
  const ys: number[] = [];
  const fades: number[] = [];
  for (let s = from + offset; s + period <= until; s += period) {
    times.push(s, s + period * 0.8, s + period * 0.8 + 1);
    ys.push(0, 24, 0);
    fades.push(1, 0, 0);
  }
  return {
    y: track(clock, times, ys, easeIn),
    opacity: track(clock, times, fades, Easing.linear),
  };
}

/** The hero wondering about the leaking tap at home. */
function ThoughtBubble({ clock }: Clocked) {
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: shown(clock, BEAT.think, BEAT.post),
      scale: track(clock, [BEAT.think, BEAT.think + 350], [0.6, 1], pop),
      drops: [0, 200, 400].map((offset) =>
        drip(clock, BEAT.think + 200, BEAT.post, offset),
      ),
    }),
    [clock],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { opacity: m.opacity },
      ]}
    >
      <View
        style={[
          styles.trailDot,
          styles.trailSmall,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      />
      <View
        style={[
          styles.trailDot,
          styles.trailLarge,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      />
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            transform: [{ scale: m.scale }],
          },
        ]}
      >
        <View style={styles.basin} />
        <View style={styles.pipe} />
        <View style={styles.spout} />
        <View style={styles.valveStem} />
        <View style={styles.valve} />
        {m.drops.map((drop, i) => (
          <Animated.View
            key={i}
            style={[
              styles.drop,
              { opacity: drop.opacity, transform: [{ translateY: drop.y }] },
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** The job search on the hero's phone, popped up above them. */
function SearchCard({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: shown(clock, BEAT.search, BEAT.notify + 50),
      scale: track(clock, [BEAT.search, BEAT.search + 300], [0.85, 1], pop),
      placeholder: track(
        clock,
        [TYPE.search.from - 40, TYPE.search.from],
        [1, 0],
      ),
      rows: JOBS.map((_, i) => {
        const from = BEAT.results + 120 * i;
        return {
          opacity: track(clock, [from, from + 220], [0, 1]),
          y: track(clock, [from, from + 260], [10, 0]),
          // Grey placeholder rows while the search runs, as the jobs list shows.
          loading: track(clock, [from - 100, from + 100], [1, 0]),
        };
      }),
    }),
    [clock],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: m.opacity,
          transform: [{ scale: m.scale }],
        },
      ]}
    >
      <View style={[styles.search, { backgroundColor: c.bg, borderColor: c.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <View style={styles.searchField}>
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.placeholder,
              { color: c.textMuted, opacity: m.placeholder },
            ]}
          >
            {t('jobs.searchHint')}
          </Animated.Text>
          <TypedText
            clock={clock}
            text={t('intro.search')}
            from={TYPE.search.from}
            until={TYPE.search.until}
            caretFrom={BEAT.search + 40}
            caretUntil={BEAT.results}
            style={[styles.typedSearch, { color: c.text }]}
          />
        </View>
      </View>

      {JOBS.map((job, i) => (
        <View key={job.initials} style={[styles.jobRow, { borderColor: c.border }]}>
          <Animated.View
            style={[styles.skeleton, { opacity: m.rows[i]!.loading }]}
          >
            <View style={[styles.skeletonLogo, { backgroundColor: c.surfaceAlt }]} />
            <View style={styles.skeletonLines}>
              <View
                style={[styles.skeletonLine, { width: 110, backgroundColor: c.surfaceAlt }]}
              />
              <View
                style={[styles.skeletonLine, { width: 70, backgroundColor: c.surfaceAlt }]}
              />
            </View>
          </Animated.View>
          <Animated.View
            style={[
              styles.jobContent,
              {
                opacity: m.rows[i]!.opacity,
                transform: [{ translateY: m.rows[i]!.y }],
              },
            ]}
          >
            <View
              style={[styles.logo, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Text style={[styles.logoText, { color: c.text }]}>{job.initials}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
                {t(job.title)}
              </Text>
              <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                {t(job.where)}
              </Text>
            </View>
            <View
              style={[
                styles.pill,
                { backgroundColor: c.successSoft, borderColor: c.success },
              ]}
            >
              <Text style={[styles.pillText, { color: c.success }]}>
                {`৳${job.pay}`}
              </Text>
            </View>
          </Animated.View>
        </View>
      ))}
    </Animated.View>
  );
}

/** The push notification: WorkFlex BD, you're hired. */
function NotifyCard({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: shown(clock, BEAT.notify, BEAT.think - 50),
      y: track(clock, [BEAT.notify, BEAT.notify + 380], [-40, 0], pop),
    }),
    [clock],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        styles.notify,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: m.opacity,
          transform: [{ translateY: m.y }],
        },
      ]}
    >
      <AppIcon size={34} />
      <View style={styles.notifyBody}>
        <View style={styles.notifyTop}>
          <BrandName height={12} />
          <Text style={[styles.notifyWhen, { color: c.textMuted }]}>
            {t('intro.notif.now')}
          </Text>
        </View>
        <Text style={[styles.notifyTitle, { color: c.text }]} numberOfLines={2}>
          {t('intro.notif.title')}
        </Text>
        <Text style={[styles.notifyText, { color: c.text }]} numberOfLines={2}>
          {t('intro.notif.body')}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Posting the plumber job, in the posting form's own fields. */
function PostCard({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const [locale] = useLocale();
  const m = useMemo(
    () => ({
      opacity: shown(clock, BEAT.post, BEAT.match + 50),
      scale: track(clock, [BEAT.post, BEAT.post + 300], [0.85, 1], pop),
      chip: track(clock, [CHIP_AT, CHIP_AT + 120], [0, 1]),
      budget: track(clock, [BUDGET_AT, BUDGET_AT + 150], [0, 1]),
      press: track(clock, pressTimes(PRESS.submit), [1, 0.95, 1]),
      posted: track(clock, [PRESS.submit + 70, PRESS.submit + 170], [0, 1]),
    }),
    [clock],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: m.opacity,
          transform: [{ scale: m.scale }],
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: c.text }]}>
        {`📢  ${t('post.title')}`}
      </Text>
      <Text style={[styles.label, { color: c.textMuted }]}>{t('post.jobTitle')}</Text>
      <View
        style={[styles.input, { backgroundColor: c.surfaceAlt, borderColor: c.primary }]}
      >
        <TypedText
          clock={clock}
          text={t('intro.plumberJob')}
          from={TYPE.title.from}
          until={TYPE.title.until}
          caretFrom={BEAT.post + 100}
          caretUntil={CHIP_AT}
          style={[styles.inputText, { color: c.text }]}
        />
      </View>
      <View style={styles.formRow}>
        <View
          style={[styles.chip, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
        >
          {/* Selected the way the form marks it: tinted, outlined, ticked. */}
          <Animated.View
            style={[
              styles.chipOn,
              {
                backgroundColor: c.primarySoft,
                borderColor: c.primary,
                opacity: m.chip,
              },
            ]}
          />
          <Animated.Text
            style={[styles.chipText, { color: c.text, opacity: m.chip }]}
          >
            {'✓ '}
          </Animated.Text>
          <Text style={[styles.chipText, { color: c.text }]} numberOfLines={1}>
            {`${TRADES_EMOJI} ${jobCategoryName('TRADES', locale)}`}
          </Text>
        </View>
        <View
          style={[styles.money, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
        >
          <Text style={[styles.moneySign, { color: c.textMuted }]}>৳</Text>
          <Animated.Text
            style={[styles.moneyText, { color: c.text, opacity: m.budget }]}
          >
            1,500
          </Animated.Text>
        </View>
      </View>
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: c.primary, transform: [{ scale: m.press }] },
        ]}
      >
        <Text style={[styles.buttonText, { color: c.primaryText }]}>
          {t('post.submit')}
        </Text>
        <Animated.View
          style={[
            styles.buttonDone,
            {
              backgroundColor: c.successSoft,
              borderColor: c.success,
              opacity: m.posted,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: c.success }]}>
            {`✓  ${t('intro.posted')}`}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** When the CV comparison settles on its best match. */
const BEST_AT = BEAT.match + 750;

/** Applicants' CVs compared with the job; the best is flagged, then hired. */
function MatchCard({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      // Stays up while the plumber walks in, so "Hired" can be read.
      opacity: shown(clock, BEAT.match, BEAT.arrive + 400),
      scale: track(clock, [BEAT.match, BEAT.match + 300], [0.85, 1], pop),
      // A sweep of AI purple down the list and back: the CVs being read.
      sweep: track(
        clock,
        [BEAT.match + 150, BEAT.match + 500, BEST_AT - 50],
        [0, 2 * ROW_STEP, 0],
        easeInOut,
      ),
      sweepOpacity: track(
        clock,
        [BEAT.match + 150, BEAT.match + 250, BEST_AT - 150, BEST_AT - 50],
        [0, 0.7, 0.7, 0],
      ),
      // The footer turns from "comparing CVs" to naming the best match.
      comparing: track(clock, [BEST_AT - 100, BEST_AT + 50], [1, 0]),
      found: track(clock, [BEST_AT, BEST_AT + 200], [0, 1]),
    }),
    [clock],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: m.opacity,
          transform: [{ scale: m.scale }],
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
        {`✨  ${t('intro.matching.title')}`}
      </Text>
      <View style={styles.rows}>
        <Animated.View
          style={[
            styles.sweep,
            {
              backgroundColor: c.aiSoft,
              opacity: m.sweepOpacity,
              transform: [{ translateY: m.sweep }],
            },
          ]}
        />
        <MatchRow clock={clock} index={0} />
        <MatchRow clock={clock} index={1} />
        <MatchRow clock={clock} index={2} />
      </View>
      <View style={styles.foot}>
        <Animated.Text
          numberOfLines={1}
          style={[styles.cardFoot, { color: c.textMuted, opacity: m.comparing }]}
        >
          {t('intro.matching.sub')}
        </Animated.Text>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.cardFoot,
            styles.footFound,
            { color: c.ai, opacity: m.found },
          ]}
        >
          {`✨ ${t('intro.best')} · ${t(CANDIDATES[0].name)} · ${CANDIDATES[0].score}%`}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

/** Height of a row in the match list, gap included. */
const ROW_STEP = 40;

/**
 * One applicant: their CV score counts up as it is read. The best is ringed,
 * its score gives way to a Hire button, and the button is pressed.
 */
function MatchRow({ clock, index }: Clocked & { index: 0 | 1 | 2 }) {
  const t = useT();
  const { c } = useTheme();
  const cand = CANDIDATES[index];
  const best = index === 0;
  const from = BEAT.match + 100 + 80 * index;
  const m = useMemo(
    () => ({
      opacity: track(
        clock,
        [from, from + 220, BEST_AT, BEST_AT + 250],
        [0, 1, 1, best ? 1 : 0.45],
      ),
      y: track(clock, [from, from + 260], [10, 0]),
      ring: track(clock, [BEST_AT, BEST_AT + 200], [0, 1]),
      hire: track(clock, [BEST_AT + 100, BEST_AT + 200], [0, 1]),
      press: track(clock, pressTimes(PRESS.hire), [1, 0.9, 1]),
      hired: track(clock, [PRESS.hire + 70, PRESS.hire + 170], [0, 1]),
    }),
    [clock, from, best],
  );

  return (
    <Animated.View
      style={[
        styles.matchRow,
        {
          // No fill of its own, so the scanning sweep shows through it.
          top: ROW_STEP * index,
          borderColor: c.border,
          opacity: m.opacity,
          transform: [{ translateY: m.y }],
        },
      ]}
    >
      {best ? (
        <Animated.View
          style={[styles.bestRing, { borderColor: c.success, opacity: m.ring }]}
        />
      ) : null}
      <View style={[styles.avatar, { backgroundColor: c.tints[index] }]}>
        <Text style={[styles.avatarText, { color: c.text }]}>{cand.initials}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
          {t(cand.name)}
        </Text>
        <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
          {t(cand.meta)}
        </Text>
      </View>
      {/* A fixed slot, so the wider Hire and Hired pills never squeeze the name. */}
      <Animated.View
        style={[styles.slot, best && { transform: [{ scale: m.press }] }]}
      >
        <View
          style={[
            styles.pill,
            { backgroundColor: c.aiSoft, borderColor: c.aiSoftBorder },
          ]}
        >
          <Counter
            clock={clock}
            from={from + 100}
            until={from + 500}
            to={cand.score}
            style={[styles.pillText, { color: c.ai }]}
          />
        </View>
        {best ? (
          <>
            <Animated.View
              style={[
                styles.pill,
                styles.pillOver,
                {
                  backgroundColor: c.primary,
                  borderColor: c.primary,
                  opacity: m.hire,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.pillText, { color: c.primaryText }]}
              >
                {t('intro.hire')}
              </Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.pill,
                styles.pillOver,
                {
                  backgroundColor: c.successSoft,
                  borderColor: c.success,
                  opacity: m.hired,
                },
              ]}
            >
              <Text numberOfLines={1} style={[styles.pillText, { color: c.success }]}>
                {`✓ ${t('intro.hired.status')}`}
              </Text>
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Types a line out a word at a time.
 *
 * Words rather than letters, because Bangla letters join: stopping part-way
 * through a word can leave a consonant hanging on a hasant — the mark that
 * joins it to the next — which draws as a visibly broken letter. Words that
 * have not arrived are not rendered at all, so the caret always sits right
 * after the last one.
 */
function TypedText({
  clock,
  text,
  from,
  until,
  caretFrom,
  caretUntil,
  style,
}: Clocked & {
  text: string;
  from: number;
  until: number;
  caretFrom: number;
  caretUntil: number;
  style: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  const words = useMemo(() => text.split(' '), [text]);
  const [count, setCount] = useState(0);
  const caret = useMemo(
    () =>
      track(
        clock,
        [caretFrom, caretFrom + 60, caretUntil - 60, caretUntil],
        [0, 1, 1, 0],
      ),
    [clock, caretFrom, caretUntil],
  );

  useEffect(() => {
    const step = (until - from) / words.length;
    const id = clock.addListener(({ value }) => {
      const next =
        value < from
          ? 0
          : Math.min(words.length, Math.floor((value - from) / step) + 1);
      setCount((current) => (current === next ? current : next));
    });
    return () => clock.removeListener(id);
  }, [clock, words.length, from, until]);

  return (
    <View style={styles.typed}>
      {words.slice(0, count).map((word, i) => (
        <Text key={i} style={style}>
          {word}
        </Text>
      ))}
      <Animated.View
        style={[styles.caret, { backgroundColor: c.primary, opacity: caret }]}
      />
    </View>
  );
}

/** A percentage that counts up as the CV is read. */
function Counter({
  clock,
  from,
  until,
  to,
  style,
}: Clocked & {
  from: number;
  until: number;
  to: number;
  style: StyleProp<TextStyle>;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const id = clock.addListener(({ value: now }) => {
      const p = Math.min(1, Math.max(0, (now - from) / (until - from)));
      const next = Math.round(to * easeOut(p));
      setValue((current) => (current === next ? current : next));
    });
    return () => clock.removeListener(id);
  }, [clock, from, until, to]);
  return <Text style={style}>{`${value}%`}</Text>;
}

/** WorkFlex BD's icon as it sits on a home screen: the locator with a bolt. */
function AppIcon({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={ICON}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.appIcon,
        { width: size, height: size, borderRadius: size * 0.26 },
      ]}
    >
      <Svg width={size * 0.64} height={size * 0.64} viewBox="0 0 24 24">
        <Path
          d="M12 2.5c-4 0-7 3.1-7 7 0 5.2 7 12 7 12s7-6.8 7-12c0-3.9-3-7-7-7z"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M12.8 6.2 9.8 11h2.4l-1 4.2 3.4-5.2h-2.5z" fill="#FFFFFF" />
      </Svg>
    </LinearGradient>
  );
}

/** A soft drop shadow: elevation on Android, a shadow everywhere else. */
const lift = (depth: number) =>
  Platform.select({
    android: { elevation: depth },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: depth * 2,
      shadowOffset: { width: 0, height: depth / 2 },
    },
  });

/** Fixed colours for the drawn things — a face, a tap — the same in either theme. */
const INK = {
  eye: '#1F1A17',
  mouth: '#5B2A20',
  blush: '#F08A72',
  phone: '#2B2862',
  camera: '#57539A',
  box: '#C8412F',
  boxDark: '#8E2D21',
  metal: '#9AA3B2',
  metalDark: '#7D8696',
  handle: '#D05A4E',
  basin: '#C9D3E0',
};

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { ...StyleSheet.absoluteFill, transformOrigin: 'left' },
  skip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 13, fontWeight: '800' },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: STAGE_W, height: STAGE_H },
  backdrop: {
    position: 'absolute',
    left: (STAGE_W - GLOW) / 2,
    top: HERO_AT.top + 150 - GLOW / 2,
  },

  caption: {
    position: 'absolute',
    top: CAPTION_TOP,
    left: 12,
    right: 12,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  shadow: {
    position: 'absolute',
    top: HERO_AT.top + 276,
    width: 110,
    height: 16,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },

  // A person, in the 200 × 310 box `FIG` describes.
  figure: { position: 'absolute', width: FIG.width, height: FIG.height },
  leg: {
    position: 'absolute',
    top: 190,
    width: 26,
    height: 86,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    transformOrigin: '13px 6px',
  },
  legLeft: { left: 71 },
  legRight: { left: 103 },
  // Each shoe points away from the other, the way a standing figure's feet are drawn.
  shoe: {
    position: 'absolute',
    bottom: -8,
    width: 36,
    height: 16,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomWidth: 4,
  },
  shoeLeft: { left: -12 },
  shoeRight: { left: 2 },
  hips: {
    position: 'absolute',
    left: 64,
    top: 178,
    width: 72,
    height: 24,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  neck: { position: 'absolute', left: 91, top: 80, width: 18, height: 18 },
  torso: {
    position: 'absolute',
    left: 62,
    top: 92,
    width: 76,
    height: 96,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  torsoShade: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 14 },
  bib: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 36,
    bottom: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  strap: { position: 'absolute', top: 0, width: 9, height: 42 },
  strapLeft: { left: 16 },
  strapRight: { right: 16 },
  neckline: {
    position: 'absolute',
    top: -10,
    left: 27,
    width: 22,
    height: 20,
    borderRadius: 11,
  },

  // The head tilts on the neck.
  head: {
    position: 'absolute',
    left: 64,
    top: 14,
    width: 72,
    height: 78,
    transformOrigin: '36px 74px',
  },
  ear: { position: 'absolute', top: 38, width: 12, height: 17, borderRadius: 6 },
  earLeft: { left: 2 },
  earRight: { right: 2 },
  face: {
    position: 'absolute',
    left: 8,
    top: 10,
    width: 56,
    height: 64,
    borderRadius: 28,
  },
  hair: {
    position: 'absolute',
    left: 5,
    top: 2,
    width: 62,
    height: 26,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 4,
  },
  fringe: {
    position: 'absolute',
    left: 34,
    top: 18,
    width: 30,
    height: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  capCrown: {
    position: 'absolute',
    left: 6,
    top: 2,
    width: 60,
    height: 28,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  capBrim: {
    position: 'absolute',
    left: 2,
    top: 25,
    width: 68,
    height: 8,
    borderRadius: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  brows: {
    position: 'absolute',
    top: 37,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 13,
  },
  brow: { width: 11, height: 3, borderRadius: 2 },
  eyes: {
    position: 'absolute',
    top: 43,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },
  eye: { width: 6, height: 8, borderRadius: 3, backgroundColor: INK.eye },
  cheek: {
    position: 'absolute',
    top: 53,
    width: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK.blush,
    opacity: 0.35,
  },
  cheekLeft: { left: 15 },
  cheekRight: { right: 15 },
  mustache: {
    position: 'absolute',
    top: 53,
    left: 25,
    width: 22,
    height: 6,
    borderRadius: 3,
  },
  smile: {
    position: 'absolute',
    top: 57,
    left: 29,
    width: 14,
    height: 7,
    borderBottomWidth: 2.5,
    borderColor: INK.mouth,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  grin: {
    position: 'absolute',
    top: 58,
    left: 28,
    width: 16,
    height: 9,
    backgroundColor: INK.mouth,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  // An arm: each segment is centred on its joint, which is its hinge.
  upperArm: {
    position: 'absolute',
    width: ARM_W,
    height: UPPER + ARM_W,
    borderRadius: ARM_W / 2,
    transformOrigin: `${ARM_W / 2}px ${ARM_W / 2}px`,
  },
  sleeve: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    borderRadius: ARM_W / 2 + 2,
  },
  forearm: {
    position: 'absolute',
    left: 0,
    top: UPPER,
    width: ARM_W,
    height: FORE + ARM_W,
    borderRadius: ARM_W / 2,
    transformOrigin: `${ARM_W / 2}px ${ARM_W / 2}px`,
  },
  hand: {
    position: 'absolute',
    left: -2,
    top: FORE - 2,
    width: ARM_W + 4,
    height: ARM_W + 4,
    borderRadius: ARM_W / 2 + 2,
  },
  // Held just past the hand, so the fingers close over its edge.
  heldPhone: {
    position: 'absolute',
    left: ARM_W / 2 - 14,
    top: ARM_W / 2 + FORE + 16 - 24,
    width: 28,
    height: 48,
    borderRadius: 7,
    backgroundColor: INK.phone,
    transform: [{ rotate: `${PHONE_TILT}deg` }],
  },
  phoneCamera: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 9,
    height: 12,
    borderRadius: 3,
    backgroundColor: INK.camera,
  },
  toolbox: {
    position: 'absolute',
    left: ARM_W / 2 - 23,
    top: ARM_W / 2 + FORE + 4,
    width: 46,
    height: 28,
    borderRadius: 5,
    backgroundColor: INK.box,
  },
  toolboxHandle: {
    position: 'absolute',
    left: 8,
    top: -10,
    width: 30,
    height: 13,
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: INK.boxDark,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  toolboxLid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    height: 4,
    backgroundColor: INK.boxDark,
  },

  confetti: { position: 'absolute', left: 160, top: 300, borderRadius: 2 },
  ray: {
    position: 'absolute',
    left: HANDSHAKE.x - 2,
    top: HANDSHAKE.y - 5,
    width: 4,
    height: 10,
    borderRadius: 2,
  },

  badges: { position: 'absolute', left: 0, right: 0, top: BADGE_TOP, height: 28 },
  badgeSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
  badgeAbove: { top: -34 },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  roleText: { fontSize: 12.5, fontWeight: '800' },

  // The thought, off the top right of the hero's head.
  trailDot: { position: 'absolute', borderWidth: 1.5 },
  trailSmall: { left: 210, top: 298, width: 10, height: 10, borderRadius: 5 },
  trailLarge: { left: 226, top: 270, width: 17, height: 17, borderRadius: 9 },
  bubble: {
    position: 'absolute',
    left: 184,
    top: 158,
    width: 116,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  pipe: {
    position: 'absolute',
    left: 16,
    top: 32,
    width: 48,
    height: 11,
    borderRadius: 3,
    backgroundColor: INK.metal,
  },
  spout: {
    position: 'absolute',
    left: 54,
    top: 32,
    width: 11,
    height: 24,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: INK.metal,
  },
  valveStem: {
    position: 'absolute',
    left: 34,
    top: 22,
    width: 6,
    height: 11,
    backgroundColor: INK.metalDark,
  },
  valve: {
    position: 'absolute',
    left: 26,
    top: 16,
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: INK.handle,
  },
  basin: {
    position: 'absolute',
    left: 26,
    top: 72,
    width: 66,
    height: 16,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: INK.basin,
  },
  drop: {
    position: 'absolute',
    left: 56,
    top: 56,
    width: 7,
    height: 10,
    borderRadius: 4,
    backgroundColor: WATER,
  },

  // The phone's screens, popped up above the hero.
  card: {
    position: 'absolute',
    left: CARD.left,
    top: CARD.top,
    width: CARD.width,
    padding: 12,
    gap: 7,
    borderRadius: 18,
    borderWidth: 1,
    ...lift(4),
  },
  cardTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  cardFoot: { fontSize: 11, lineHeight: 14, fontWeight: '600' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 14 },
  searchField: { flex: 1, height: '100%', justifyContent: 'center' },
  placeholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  typedSearch: { fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  jobRow: {
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  jobContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skeleton: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  skeletonLogo: { width: 30, height: 30, borderRadius: 8 },
  skeletonLines: { gap: 6 },
  skeletonLine: { height: 8, borderRadius: 4 },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 11, fontWeight: '800' },
  rowBody: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  rowMeta: { fontSize: 10.5, lineHeight: 13 },
  pill: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 11, fontWeight: '800' },
  // Where a match row's score sits; Hire and Hired take its place, right-aligned.
  slot: { width: 104, height: 24, alignItems: 'flex-end', justifyContent: 'center' },
  pillOver: { position: 'absolute', top: 0, right: 0 },

  notify: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notifyBody: { flex: 1, gap: 2 },
  notifyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifyWhen: { fontSize: 10.5 },
  notifyTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  notifyText: { fontSize: 12, lineHeight: 16 },
  appIcon: { alignItems: 'center', justifyContent: 'center' },

  label: { fontSize: 11.5, lineHeight: 14, fontWeight: '600' },
  input: {
    height: 34,
    marginTop: -3,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inputText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  formRow: { flexDirection: 'row', gap: 8, height: 30 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
  },
  // Laid over the chip's own outline, so selecting it swaps one for the other.
  chipOn: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  money: {
    width: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  moneySign: { fontSize: 13, fontWeight: '800' },
  moneyText: { fontSize: 13, fontWeight: '800' },
  button: {
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13.5, fontWeight: '800' },
  buttonDone: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rows: { height: 2 * ROW_STEP + 34 },
  sweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 34,
    borderRadius: 10,
  },
  matchRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  bestRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 12,
    borderWidth: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 10, fontWeight: '800' },
  foot: { height: 14 },
  footFound: { position: 'absolute', top: 0, left: 0, right: 0, fontWeight: '800' },

  typed: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    overflow: 'hidden',
  },
  caret: { width: 2, height: 16, borderRadius: 1 },
});
