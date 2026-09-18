import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';

/**
 * "One account, two roles": the ten seconds that play before the landing
 * page.
 *
 * The same person finds a job and applies, then turns the phone over, posts
 * one, and someone answers. That is the product's one real differentiator,
 * and it is told without a paragraph of copy — every beat is an action on a
 * phone screen, and the only sentence is the last one.
 *
 * Drawn with views rather than shipped as a video. A video is a heavy
 * download before the first screen on patchy mobile data, is either blurry or
 * wasteful at most of the screen sizes this runs on, and cannot follow the
 * reader's language or their light and dark setting. Here every word comes
 * from the translation table and every colour but one from the theme.
 *
 * Everything hangs off one clock running from 0 to 10,000 ms. Each element
 * reads the beat of the storyboard it belongs to, so the piece stays in step
 * by construction, and a beat is retimed by changing its number in `BEAT`.
 */

/** The storyboard in milliseconds, one entry per line of the brief. */
const BEAT = {
  appear: 0, // a young person appears, holding a phone
  findJobs: 1000, // they tap Find Jobs
  list: 2000, // three job cards arrive
  match: 3000, // one lifts towards them: Perfect Match
  apply: 4000, // they tap Apply, and the application is sent
  flip: 5000, // the screen turns over to Post a Job
  post: 6000, // they type the job and post it
  meet: 7000, // someone else's profile appears: Interested
  link: 8000, // the two profiles connect
  words: 9000, // Find work. Find workers.
  end: 10000,
} as const;

/** When each tap presses down. The finger and the button it presses share it. */
const PRESS = {
  findJobs: BEAT.findJobs + 450,
  apply: BEAT.apply + 400,
  post: BEAT.post + 750,
} as const;

/** A press: down in 70 ms, back up by 200. */
const pressTimes = (at: number) => [at, at + 70, at + 200];

/** When the job is typed out, within the post beat. */
const TYPE_FROM = BEAT.post + 60;
const TYPE_UNTIL = BEAT.post + 620;

/**
 * The stage is laid out once at this size and scaled to fit the screen, so
 * every position below is a plain number rather than a share of the window.
 */
const STAGE_W = 320;
const STAGE_H = 600;

/** Height of the progress-and-Skip bar, below the safe-area inset. */
const BAR = 52;

const HEAD = 76;
const PERSON_W = 150;
/** Where the person's head is while they hold the phone. */
const HOLD = { x: 160, y: 62 };
/** Where the two profiles stand once they meet. */
const PAIR = { y: 234, left: 72, right: 248 };

const PHONE = { left: 48, top: 126, width: 224, height: 372, bezel: 7 };
const SCREEN = {
  top: PHONE.top + PHONE.bezel,
  width: PHONE.width - PHONE.bezel * 2,
  height: PHONE.height - PHONE.bezel * 2,
};

/** Positions inside the phone's screen. */
const FIND_BUTTON = { top: 176, height: 48 };
const POST_BUTTON = { top: 186, height: 46 };
const CARD = {
  left: 12,
  width: 186,
  height: 60,
  tops: [66, 136, 206],
} as const;
const APPLY = { width: 56, height: 26, right: 10 };

/** How far the matched card rises towards the person, and how much it grows. */
const LIFT = 24;
const LIFT_SCALE = 1.06;

/**
 * Where each tap lands, in stage coordinates — the middle of what is tapped.
 * The screen is centred on the stage, so anything centred on the screen sits
 * at the stage's middle too.
 */
const TAPS = {
  findJobs: {
    x: STAGE_W / 2,
    y: SCREEN.top + FIND_BUTTON.top + FIND_BUTTON.height / 2,
  },
  apply: {
    x:
      STAGE_W / 2 +
      (CARD.width / 2 - APPLY.right - APPLY.width / 2) * LIFT_SCALE,
    y: SCREEN.top + CARD.tops[0] - LIFT + CARD.height / 2,
  },
  post: {
    x: STAGE_W / 2,
    y: SCREEN.top + POST_BUTTON.top + POST_BUTTON.height / 2,
  },
};

const LINK = {
  left: PAIR.left + HEAD / 2 + 8,
  width: PAIR.right - PAIR.left - HEAD - 16,
};
const SPARK = 22;
const FINGER = 34;
const WORDS_TOP = 340;
const GLOW = 380;

/**
 * The one colour not taken from the theme: skin, matched to the medium skin
 * tone of the face above, so the hands read as that person's.
 */
const SKIN = '#C98B62';

const JOBS = [
  { icon: '📚', key: 'intro.job.tutor' },
  { icon: '🎨', key: 'intro.job.designer' },
  { icon: '🗂️', key: 'intro.job.assistant' },
] as const;

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
  ease: Ease = easeOut,
) {
  const { inputRange, outputRange } = keyframes(times, degrees, ease);
  return clock.interpolate({
    inputRange,
    outputRange: outputRange.map((deg) => `${deg}deg`),
    extrapolate: 'clamp',
  });
}

/** The ring that closes round each face once the two are connected. */
function connectedRing(clock: Animated.Value) {
  return {
    ring: track(clock, [BEAT.link + 500, BEAT.link + 800], [0, 1]),
    ringScale: track(
      clock,
      [BEAT.link + 500, BEAT.link + 800],
      [0.85, 1],
      pop,
    ),
  };
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
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
          <Meeting clock={clock} />
          <Other clock={clock} />
          <Phone clock={clock} />
          <Lead clock={clock} />
          <Closing clock={clock} />
          <Finger clock={clock} />
        </View>
      </View>
    </View>
  );
}

/** A soft pool of the brand colour behind the person, so the stage is not flat. */
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

function Head({
  face,
  fill,
  border,
}: {
  face: string;
  fill: string;
  border: string;
}) {
  return (
    <View style={[styles.head, { backgroundColor: fill, borderColor: border }]}>
      <Text style={styles.face}>{face}</Text>
    </View>
  );
}

function Pill({
  icon,
  label,
  fill,
  border,
  color,
}: {
  icon: string;
  label: string;
  fill: string;
  border: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: fill, borderColor: border }]}>
      <Text style={[styles.pillIcon, { color }]}>{icon}</Text>
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Nadia, the person the story follows: holds the phone, finds work, then
 * hires. The same face throughout, with only the role under it changing.
 */
function Lead({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: track(clock, [BEAT.appear, BEAT.appear + 350], [0, 1]),
      scale: track(clock, [BEAT.appear, BEAT.appear + 600], [0.6, 1], pop),
      // Crosses to meet the other profile as the phone goes.
      x: track(
        clock,
        [BEAT.meet, BEAT.meet + 700],
        [0, PAIR.left - HOLD.x],
        easeInOut,
      ),
      y: track(
        clock,
        [BEAT.meet, BEAT.meet + 700],
        [0, PAIR.y - HOLD.y],
        easeInOut,
      ),
      // The role flips over with the screen: same person, other role.
      seeker: track(
        clock,
        [BEAT.appear + 250, BEAT.appear + 550, BEAT.flip + 499, BEAT.flip + 500],
        [0, 1, 1, 0],
      ),
      seekerTurn: turn(clock, [BEAT.flip, BEAT.flip + 500], [0, 90], easeIn),
      hiring: track(clock, [BEAT.flip + 499, BEAT.flip + 500], [0, 1]),
      hiringTurn: turn(clock, [BEAT.flip + 500, BEAT.flip + 1000], [-90, 0]),
      name: track(clock, [BEAT.meet + 500, BEAT.meet + 900], [0, 1]),
      ...connectedRing(clock),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.person,
        {
          left: HOLD.x - PERSON_W / 2,
          top: HOLD.y - HEAD / 2,
          opacity: m.opacity,
          transform: [
            { translateX: m.x },
            { translateY: m.y },
            { scale: m.scale },
          ],
        },
      ]}
    >
      <View>
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: c.primary,
              opacity: m.ring,
              transform: [{ scale: m.ringScale }],
            },
          ]}
        />
        <Head face="🧑🏽" fill={c.tints[2]} border={c.tintBorders[2]} />
      </View>
      <View style={styles.pillSlot}>
        <Animated.View
          style={[
            styles.pillCentre,
            {
              opacity: m.seeker,
              transform: [{ perspective: 400 }, { rotateX: m.seekerTurn }],
            },
          ]}
        >
          <Pill
            icon="🔍"
            label={t('intro.role.seeker')}
            fill={c.tints[1]}
            border={c.tintBorders[1]}
            color={c.text}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.pillCentre,
            {
              opacity: m.hiring,
              transform: [{ perspective: 400 }, { rotateX: m.hiringTurn }],
            },
          ]}
        >
          <Pill
            icon="📢"
            label={t('intro.role.hiring')}
            fill={c.tints[0]}
            border={c.tintBorders[0]}
            color={c.text}
          />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.name, { color: c.text, opacity: m.name }]}>
        {t('intro.name')}
      </Animated.Text>
    </Animated.View>
  );
}

/** Rahim, who answers the post. */
function Other({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: track(clock, [BEAT.meet + 300, BEAT.meet + 700], [0, 1]),
      x: track(clock, [BEAT.meet + 300, BEAT.meet + 900], [56, 0]),
      interested: track(clock, [BEAT.meet + 800, BEAT.meet + 1000], [0, 1]),
      interestedScale: track(
        clock,
        [BEAT.meet + 800, BEAT.meet + 1100],
        [0.5, 1],
        pop,
      ),
      ...connectedRing(clock),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.person,
        {
          left: PAIR.right - PERSON_W / 2,
          top: PAIR.y - HEAD / 2,
          opacity: m.opacity,
          transform: [{ translateX: m.x }],
        },
      ]}
    >
      <View>
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: c.primary,
              opacity: m.ring,
              transform: [{ scale: m.ringScale }],
            },
          ]}
        />
        <Head face="🧑🏾" fill={c.tints[3]} border={c.tintBorders[3]} />
      </View>
      <View style={styles.pillSlot}>
        <Animated.View
          style={[
            styles.pillCentre,
            {
              opacity: m.interested,
              transform: [{ scale: m.interestedScale }],
            },
          ]}
        >
          <Pill
            icon="✋"
            label={t('intro.interested')}
            fill={c.successSoft}
            border={c.successSoft}
            color={c.success}
          />
        </Animated.View>
      </View>
      <Text style={[styles.name, { color: c.text }]}>
        {t('intro.otherName')}
      </Text>
    </Animated.View>
  );
}

/** The phone, and the three screens the story passes through. */
function Phone({ clock }: Clocked) {
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: track(
        clock,
        [BEAT.appear + 150, BEAT.appear + 550, BEAT.meet, BEAT.meet + 450],
        [0, 1, 1, 0],
      ),
      y: track(
        clock,
        [BEAT.appear + 150, BEAT.appear + 750, BEAT.meet, BEAT.meet + 450],
        [48, 0, 0, 36],
      ),
      scale: track(clock, [BEAT.meet, BEAT.meet + 450], [1, 0.88]),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.phone,
        {
          opacity: m.opacity,
          transform: [{ translateY: m.y }, { scale: m.scale }],
        },
      ]}
    >
      <View style={[styles.bezel, { backgroundColor: c.text }]} />
      <View style={[styles.screen, { backgroundColor: c.surface }]}>
        <HomeScreen clock={clock} />
        <JobList clock={clock} />
        <PostJob clock={clock} />
        <View style={[styles.island, { backgroundColor: c.text }]} />
      </View>
      {/* Over the screen's edge, the way fingers wrap round a real one. */}
      <View style={[styles.hand, styles.handLeft]} />
      <View style={[styles.hand, styles.handRight]} />
    </Animated.View>
  );
}

function HomeScreen({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: track(
        clock,
        [BEAT.findJobs + 800, BEAT.findJobs + 1050],
        [1, 0],
      ),
      x: track(
        clock,
        [BEAT.findJobs + 800, BEAT.findJobs + 1100],
        [0, -36],
        easeIn,
      ),
      press: track(clock, pressTimes(PRESS.findJobs), [1, 0.95, 1]),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.page,
        { opacity: m.opacity, transform: [{ translateX: m.x }] },
      ]}
    >
      <Text style={[styles.hello, { color: c.text }]}>
        {t('intro.hi', { name: t('intro.name') })}
      </Text>
      <Text style={[styles.helloSub, { color: c.textMuted }]}>
        {t('intro.today')}
      </Text>
      <Animated.View
        style={[
          styles.bigButton,
          {
            top: FIND_BUTTON.top,
            height: FIND_BUTTON.height,
            backgroundColor: c.primary,
            transform: [{ scale: m.press }],
          },
        ]}
      >
        <Text style={[styles.bigButtonText, { color: c.primaryText }]}>
          {`🔍  ${t('intro.findJobs')}`}
        </Text>
      </Animated.View>
      <View
        style={[
          styles.bigButton,
          {
            top: FIND_BUTTON.top + FIND_BUTTON.height + 12,
            height: FIND_BUTTON.height,
            backgroundColor: c.primarySoft,
            borderColor: c.primarySoftBorder,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[styles.bigButtonText, { color: c.primary }]}>
          {`📢  ${t('intro.postJob')}`}
        </Text>
      </View>
    </Animated.View>
  );
}

function JobList({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: track(
        clock,
        [BEAT.list - 100, BEAT.list + 150, BEAT.flip + 499, BEAT.flip + 500],
        [0, 1, 1, 0],
      ),
      x: track(clock, [BEAT.list - 100, BEAT.list + 200], [36, 0]),
      // Turns away until it is edge-on; the post screen turns in from there.
      turn: turn(clock, [BEAT.flip, BEAT.flip + 500], [0, 90], easeIn),
      title: track(clock, [BEAT.match, BEAT.match + 300], [1, 0]),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.page,
        {
          opacity: m.opacity,
          transform: [
            { perspective: 900 },
            { translateX: m.x },
            { rotateY: m.turn },
          ],
        },
      ]}
    >
      <Animated.Text
        style={[styles.pageTitle, { color: c.text, opacity: m.title }]}
      >
        {t('intro.jobsForYou')}
      </Animated.Text>
      <JobCard clock={clock} index={1} />
      <JobCard clock={clock} index={2} />
      <MatchedCard clock={clock} />
    </Animated.View>
  );
}

function CardContent({
  icon,
  title,
  tint,
  reserve = false,
}: {
  icon: string;
  title: string;
  tint: string;
  /** Leave room on the right for the Apply button. */
  reserve?: boolean;
}) {
  const { c } = useTheme();
  return (
    <>
      <View style={[styles.cardIcon, { backgroundColor: tint }]}>
        <Text style={styles.cardEmoji}>{icon}</Text>
      </View>
      <View style={[styles.cardBody, reserve && styles.cardBodyReserve]}>
        <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.skeleton, { backgroundColor: c.surfaceAlt }]} />
      </View>
    </>
  );
}

/** The two cards that are not the match: they arrive, then step back. */
function JobCard({ clock, index }: Clocked & { index: 1 | 2 }) {
  const t = useT();
  const { c } = useTheme();
  const job = JOBS[index];
  const m = useMemo(() => {
    const from = BEAT.list + 100 + 150 * index;
    return {
      opacity: track(
        clock,
        [from, from + 300, BEAT.match, BEAT.match + 400],
        [0, 1, 1, 0.35],
      ),
      y: track(clock, [from, from + 350], [18, 0]),
    };
  }, [clock, index]);

  return (
    <Animated.View
      style={[
        styles.card,
        styles.cardFace,
        {
          top: CARD.tops[index],
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: m.opacity,
          transform: [{ translateY: m.y }],
        },
      ]}
    >
      <CardContent icon={job.icon} title={t(job.key)} tint={c.tints[index]} />
    </Animated.View>
  );
}

/**
 * The tutor job: rises towards the person, is flagged as the match, and is
 * applied to. Drawn last in the list so it passes over the others.
 */
function MatchedCard({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const job = JOBS[0];
  const m = useMemo(
    () => ({
      opacity: track(clock, [BEAT.list + 100, BEAT.list + 400], [0, 1]),
      y: track(
        clock,
        [BEAT.list + 100, BEAT.list + 450, BEAT.match, BEAT.match + 500],
        [18, 0, 0, -LIFT],
      ),
      scale: track(clock, [BEAT.match, BEAT.match + 500], [1, LIFT_SCALE]),
      glow: track(clock, [BEAT.match + 100, BEAT.match + 500], [0, 1]),
      badge: track(clock, [BEAT.match + 300, BEAT.match + 500], [0, 1]),
      badgeScale: track(
        clock,
        [BEAT.match + 300, BEAT.match + 650],
        [0.6, 1],
        pop,
      ),
      apply: track(
        clock,
        [BEAT.match + 400, BEAT.match + 700, PRESS.apply + 100, PRESS.apply + 200],
        [0, 1, 1, 0],
      ),
      applyPress: track(clock, pressTimes(PRESS.apply), [1, 0.9, 1]),
      check: track(clock, [PRESS.apply + 100, PRESS.apply + 250], [0, 1]),
      checkScale: track(
        clock,
        [PRESS.apply + 100, PRESS.apply + 350],
        [0.5, 1],
        pop,
      ),
      sent: track(clock, [PRESS.apply + 150, PRESS.apply + 400], [0, 1]),
      sentY: track(clock, [PRESS.apply + 150, PRESS.apply + 400], [-8, 0]),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.card,
        {
          top: CARD.tops[0],
          opacity: m.opacity,
          transform: [{ translateY: m.y }, { scale: m.scale }],
        },
      ]}
    >
      {/* Purple, like every other figure the system worked out. */}
      <Animated.View
        style={[
          styles.matchGlow,
          {
            backgroundColor: c.aiSoft,
            borderColor: c.aiSoftBorder,
            opacity: m.glow,
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.cardFace,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <CardContent
          icon={job.icon}
          title={t(job.key)}
          tint={c.tints[0]}
          reserve
        />
      </View>
      <Animated.View
        style={[
          styles.apply,
          {
            backgroundColor: c.primary,
            opacity: m.apply,
            transform: [{ scale: m.applyPress }],
          },
        ]}
      >
        <Text style={[styles.applyText, { color: c.primaryText }]}>
          {t('intro.apply')}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.apply,
          {
            backgroundColor: c.successSoft,
            opacity: m.check,
            transform: [{ scale: m.checkScale }],
          },
        ]}
      >
        <Text style={[styles.applyText, { color: c.success }]}>✓</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.flag,
          { top: -13, opacity: m.badge, transform: [{ scale: m.badgeScale }] },
        ]}
      >
        <Pill
          icon="✨"
          label={t('intro.perfectMatch')}
          fill={c.aiSoft}
          border={c.aiSoftBorder}
          color={c.ai}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.flag,
          {
            top: CARD.height - 11,
            opacity: m.sent,
            transform: [{ translateY: m.sentY }],
          },
        ]}
      >
        <Pill
          icon="✓"
          label={t('intro.sent')}
          fill={c.successSoft}
          border={c.successSoft}
          color={c.success}
        />
      </Animated.View>
    </Animated.View>
  );
}

function PostJob({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      opacity: track(clock, [BEAT.flip + 499, BEAT.flip + 500], [0, 1]),
      turn: turn(clock, [BEAT.flip + 500, BEAT.flip + 1000], [-90, 0]),
      press: track(clock, pressTimes(PRESS.post), [1, 0.95, 1]),
      posted: track(clock, [PRESS.post + 100, PRESS.post + 200], [0, 1]),
    }),
    [clock],
  );

  return (
    <Animated.View
      style={[
        styles.page,
        {
          opacity: m.opacity,
          transform: [{ perspective: 900 }, { rotateY: m.turn }],
        },
      ]}
    >
      <Text style={[styles.pageTitle, { color: c.text }]}>
        {`📢  ${t('intro.postJob')}`}
      </Text>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
        {t('intro.need')}
      </Text>
      <View
        style={[
          styles.field,
          { backgroundColor: c.surfaceAlt, borderColor: c.primary },
        ]}
      >
        <TypedLine clock={clock} text={t('intro.jobText')} />
      </View>
      <Animated.View
        style={[
          styles.bigButton,
          {
            top: POST_BUTTON.top,
            height: POST_BUTTON.height,
            backgroundColor: c.primary,
            transform: [{ scale: m.press }],
          },
        ]}
      >
        <Text style={[styles.bigButtonText, { color: c.primaryText }]}>
          {t('intro.post')}
        </Text>
        <Animated.View
          style={[
            styles.posted,
            { backgroundColor: c.successSoft, opacity: m.posted },
          ]}
        >
          <Text style={[styles.bigButtonText, { color: c.success }]}>
            {`✓  ${t('intro.posted')}`}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Types the job out a word at a time.
 *
 * Words rather than letters, because Bangla letters join: stopping part-way
 * through a word can leave a consonant hanging on a hasant — the mark that
 * joins it to the next — which draws as a visibly broken letter. Words that
 * have not arrived are not rendered at all, so the caret always sits right
 * after the last one.
 */
function TypedLine({ clock, text }: Clocked & { text: string }) {
  const { c } = useTheme();
  const words = useMemo(() => text.split(' '), [text]);
  const [shown, setShown] = useState(0);
  const caret = useMemo(
    () =>
      track(
        clock,
        [BEAT.post, BEAT.post + 60, PRESS.post - 50, PRESS.post + 10],
        [0, 1, 1, 0],
      ),
    [clock],
  );

  useEffect(() => {
    const step = (TYPE_UNTIL - TYPE_FROM) / words.length;
    const id = clock.addListener(({ value }) => {
      const next =
        value < TYPE_FROM
          ? 0
          : Math.min(words.length, Math.floor((value - TYPE_FROM) / step) + 1);
      setShown((current) => (current === next ? current : next));
    });
    return () => clock.removeListener(id);
  }, [clock, words.length]);

  return (
    <View style={styles.typed}>
      {words.slice(0, shown).map((word, i) => (
        <Text key={i} style={[styles.typedWord, { color: c.text }]}>
          {word}
        </Text>
      ))}
      <Animated.View
        style={[styles.caret, { backgroundColor: c.primary, opacity: caret }]}
      />
    </View>
  );
}

/** What the two meet over — the job — and the line that connects them. */
function Meeting({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      chip: track(clock, [BEAT.meet + 450, BEAT.meet + 850], [0, 1]),
      chipY: track(clock, [BEAT.meet + 450, BEAT.meet + 850], [10, 0]),
      line: track(clock, [BEAT.link - 1, BEAT.link], [0, 0.7]),
      draw: track(clock, [BEAT.link, BEAT.link + 550], [0.001, 1], easeInOut),
      spark: track(
        clock,
        [BEAT.link + 250, BEAT.link + 950],
        [0, LINK.width],
        easeInOut,
      ),
      sparkOpacity: track(
        clock,
        [BEAT.link + 249, BEAT.link + 250, BEAT.link + 850, BEAT.link + 950],
        [0, 1, 1, 0],
      ),
    }),
    [clock],
  );

  return (
    <>
      <Animated.View
        style={[
          styles.row,
          {
            top: PAIR.y - HEAD / 2 - 54,
            opacity: m.chip,
            transform: [{ translateY: m.chipY }],
          },
        ]}
      >
        <Pill
          icon="📚"
          label={t('intro.jobChip')}
          fill={c.surface}
          border={c.border}
          color={c.text}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.link,
          {
            backgroundColor: c.primary,
            opacity: m.line,
            transform: [{ scaleX: m.draw }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.spark,
          { opacity: m.sparkOpacity, transform: [{ translateX: m.spark }] },
        ]}
      >
        <View style={[styles.sparkHalo, { backgroundColor: c.primary }]} />
        <View style={[styles.sparkDot, { backgroundColor: c.primary }]} />
      </Animated.View>
    </>
  );
}

/** The only sentence in the piece. */
function Closing({ clock }: Clocked) {
  const t = useT();
  const { c } = useTheme();
  const m = useMemo(
    () => ({
      first: track(clock, [BEAT.words, BEAT.words + 400], [0, 1]),
      firstY: track(clock, [BEAT.words, BEAT.words + 400], [14, 0]),
      second: track(clock, [BEAT.words + 250, BEAT.words + 650], [0, 1]),
      secondY: track(clock, [BEAT.words + 250, BEAT.words + 650], [14, 0]),
    }),
    [clock],
  );

  return (
    <>
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
            top: WORDS_TOP + 42,
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

/** The reader's thumb: where each tap lands, with a ripple as it presses. */
function Finger({ clock }: Clocked) {
  const { c } = useTheme();
  const m = useMemo(() => {
    const { findJobs: a, apply: b, post: p } = TAPS;
    const presses = [PRESS.findJobs, PRESS.apply, PRESS.post];
    // Comes in from below and to the right, as a thumb does, and only jumps
    // to the next target at the moment it starts to fade back in.
    const times = [
      PRESS.findJobs - 450,
      PRESS.findJobs - 50,
      PRESS.apply - 451,
      PRESS.apply - 450,
      PRESS.apply - 50,
      PRESS.post - 451,
      PRESS.post - 450,
      PRESS.post - 50,
    ];
    const xs = [a.x + 22, a.x, a.x, b.x + 22, b.x, b.x, p.x + 22, p.x];
    const ys = [a.y + 40, a.y, a.y, b.y + 40, b.y, b.y, p.y + 40, p.y];
    return {
      x: track(clock, times, xs.map((x) => x - FINGER / 2)),
      y: track(clock, times, ys.map((y) => y - FINGER / 2)),
      opacity: track(
        clock,
        presses.flatMap((at) => [at - 450, at - 250, at + 250, at + 450]),
        presses.flatMap(() => [0, 1, 1, 0]),
      ),
      press: track(
        clock,
        presses.flatMap((at) => pressTimes(at)),
        presses.flatMap(() => [1, 0.78, 1]),
      ),
      ripple: track(
        clock,
        presses.flatMap((at) => [at, at + 400]),
        presses.flatMap(() => [0.6, 2.2]),
      ),
      rippleOpacity: track(
        clock,
        presses.flatMap((at) => [at - 1, at, at + 400]),
        presses.flatMap(() => [0, 0.5, 0]),
      ),
    };
  }, [clock]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.finger,
        {
          opacity: m.opacity,
          transform: [{ translateX: m.x }, { translateY: m.y }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.ripple,
          {
            borderColor: c.text,
            opacity: m.rippleOpacity,
            transform: [{ scale: m.ripple }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.touch,
          { backgroundColor: c.text, transform: [{ scale: m.press }] },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    top: 290 - GLOW / 2,
  },

  person: { position: 'absolute', width: PERSON_W, alignItems: 'center' },
  head: {
    width: HEAD,
    height: HEAD,
    borderRadius: HEAD / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: { fontSize: 42 },
  ring: {
    position: 'absolute',
    top: -7,
    left: -7,
    width: HEAD + 14,
    height: HEAD + 14,
    borderRadius: (HEAD + 14) / 2,
    borderWidth: 2,
  },
  pillSlot: { alignSelf: 'stretch', height: 24, marginTop: -12 },
  pillCentre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  name: { marginTop: 6, fontSize: 13, fontWeight: '800' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillIcon: { fontSize: 11, fontWeight: '800' },
  pillText: { fontSize: 11.5, fontWeight: '800' },

  phone: {
    position: 'absolute',
    left: PHONE.left,
    top: PHONE.top,
    width: PHONE.width,
    height: PHONE.height,
  },
  bezel: { ...StyleSheet.absoluteFill, borderRadius: 32 },
  screen: {
    position: 'absolute',
    left: PHONE.bezel,
    top: PHONE.bezel,
    width: SCREEN.width,
    height: SCREEN.height,
    borderRadius: 25,
    overflow: 'hidden',
  },
  island: {
    position: 'absolute',
    top: 8,
    left: (SCREEN.width - 52) / 2,
    width: 52,
    height: 15,
    borderRadius: 8,
  },
  hand: {
    position: 'absolute',
    top: 196,
    width: 18,
    height: 58,
    borderRadius: 9,
    backgroundColor: SKIN,
  },
  handLeft: { left: -10 },
  handRight: { right: -10 },

  page: { ...StyleSheet.absoluteFill },
  hello: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    fontSize: 16,
    fontWeight: '800',
  },
  helloSub: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    fontSize: 11.5,
    fontWeight: '600',
  },
  pageTitle: {
    position: 'absolute',
    top: 38,
    left: 14,
    right: 14,
    fontSize: 15,
    fontWeight: '800',
  },
  bigButton: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonText: { fontSize: 14, fontWeight: '800' },
  posted: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    position: 'absolute',
    left: CARD.left,
    width: CARD.width,
    height: CARD.height,
  },
  cardFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 18 },
  cardBody: { flex: 1, gap: 7 },
  cardBodyReserve: { marginRight: APPLY.width },
  // Two lines rather than an ellipsis: "Part-time Assistant" does not fit one
  // line of a card this size, and a cut-off job title reads as a bug.
  cardTitle: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  skeleton: { width: 64, height: 7, borderRadius: 4 },
  matchGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 19,
    borderWidth: 1,
  },
  apply: {
    position: 'absolute',
    right: APPLY.right,
    top: (CARD.height - APPLY.height) / 2,
    width: APPLY.width,
    height: APPLY.height,
    borderRadius: APPLY.height / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontSize: 11.5, fontWeight: '800' },
  flag: { position: 'absolute', left: -30, right: -30, alignItems: 'center' },

  fieldLabel: {
    position: 'absolute',
    top: 72,
    left: 14,
    fontSize: 11.5,
    fontWeight: '600',
  },
  field: {
    position: 'absolute',
    top: 92,
    left: 12,
    right: 12,
    height: 78,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  typed: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 4,
    rowGap: 2,
  },
  typedWord: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caret: { width: 2, height: 18, borderRadius: 1 },

  row: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  link: {
    position: 'absolute',
    left: LINK.left,
    top: PAIR.y - 1,
    width: LINK.width,
    height: 2,
    borderRadius: 1,
    transformOrigin: 'left',
  },
  spark: {
    position: 'absolute',
    left: LINK.left - SPARK / 2,
    top: PAIR.y - SPARK / 2,
    width: SPARK,
    height: SPARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkHalo: {
    ...StyleSheet.absoluteFill,
    borderRadius: SPARK / 2,
    opacity: 0.2,
  },
  sparkDot: { width: 8, height: 8, borderRadius: 4 },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.6,
  },

  finger: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FINGER,
    height: FINGER,
  },
  touch: {
    ...StyleSheet.absoluteFill,
    borderRadius: FINGER / 2,
    opacity: 0.28,
  },
  ripple: {
    ...StyleSheet.absoluteFill,
    borderRadius: FINGER / 2,
    borderWidth: 2,
  },
});
