import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { useReduceMotion } from '../../lib/use-reduce-motion';
import { font, radius } from '../../lib/theme';
import { ArrowIcon, BriefcaseIcon, CloseIcon, SearchIcon } from './HomeIcons';

/**
 * Job titles the open field's placeholder flips through. Each is a role from
 * the shared category list (JOB_CATEGORIES), one per kind of work, and they
 * stay in English in both languages, as that list does. An even count, so
 * the button's alternating icons meet up again when the list starts over.
 */
const EXAMPLES = [
  'Electrician',
  'Home tutor',
  'Barista',
  'Car driver',
  'Nurse',
  'Cashier',
  'Security guard',
  'Data entry',
];

/** The bell's size, so the closed button matches the one beside it. */
const BAR_HEIGHT = 44;
const OPEN_MAX = 460;
/**
 * The open bar shows its own go button only from this width. On a phone the
 * keyboard's search key does that job, and the field needs the room more.
 */
const GO_MIN = 300;

const DWELL_MS = 2200;
const FLIP_MS = 520;
const OPEN_MS = 380;

/**
 * A browser draws its own focus ring round a focused field — a box inside
 * the pill here, while the pill's border already turns the primary colour
 * when open. Chrome's ring is `outline-style: auto`, which ignores a zero
 * width, so the style itself is switched off. React Native's types only list
 * the visible styles, hence the cast; phones have no ring to remove.
 */
const NO_FOCUS_RING = Platform.select<TextStyle>({
  web: { outlineStyle: 'none' } as unknown as TextStyle,
  default: {},
});

/**
 * The dashboard's job search: a round icon left of the bell that flips open.
 *
 * Closed, it is a button the size of the bell, and its icon flips every few
 * seconds — a magnifier turning into a briefcase and back — so it reads as
 * "search jobs" while taking no more room than the bell does. Tapped, it turns
 * over like a sign on a hinge and comes up as a text field, widening leftwards
 * as far as it needs to; the field's placeholder flips through example job
 * titles. On a phone the field covers the wordmark and the menu button until
 * the search is closed again; on a wide screen it never reaches either.
 *
 * The header lays this over its row and measures where it goes: `reach` is
 * the width from the start of the row to the bell, and `right` the distance
 * from the bell's side of the row. Laid over the row rather than inside the
 * wordmark's slot so that, open, it stays within its parent's bounds —
 * Android does not deliver a touch to the part of a view that hangs outside
 * its parent.
 */
export function HeaderSearch({
  reach,
  right,
}: {
  reach: number;
  right: number;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();

  const [open, setOpen] = useState(false);
  // The field stays mounted until the closing flip has finished, so the face
  // turning away still shows what it held rather than an empty bar.
  const [fieldMounted, setFieldMounted] = useState(false);
  const [query, setQuery] = useState('');

  const closedWidth = BAR_HEIGHT;
  const openWidth = Math.max(closedWidth, Math.min(reach, OPEN_MAX));
  const showGo = openWidth >= GO_MIN && query.trim() !== '';

  /** 0 closed, 1 open. Drives the turn between the two faces. */
  const flip = useRef(new Animated.Value(0)).current;
  /** Layout, so it cannot use the native driver; kept on its own view. */
  const width = useRef(new Animated.Value(closedWidth)).current;
  /** Counts up one per example; shared, so opening keeps the same word. */
  const clock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = reduceMotion ? 0 : OPEN_MS;
    const turn = Animated.timing(flip, {
      toValue: open ? 1 : 0,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const grow = Animated.timing(width, {
      toValue: open ? openWidth : closedWidth,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    turn.start(({ finished }) => {
      if (finished && !open) setFieldMounted(false);
    });
    grow.start();
    return () => {
      turn.stop();
      grow.stop();
    };
  }, [open, openWidth, closedWidth, flip, width, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      clock.setValue(0);
      return;
    }
    const steps: Animated.CompositeAnimation[] = [];
    for (let k = 1; k <= EXAMPLES.length; k++) {
      steps.push(
        Animated.delay(DWELL_MS),
        Animated.timing(clock, {
          toValue: k,
          duration: FLIP_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      );
    }
    // Each pass ends on the first word again, and the loop restarts from it,
    // so the seam is invisible.
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [clock, reduceMotion]);

  const close = useCallback(() => {
    setQuery('');
    setOpen(false);
  }, []);

  // Android's back button closes the search before it leaves the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open, close]);

  const openSearch = () => {
    setFieldMounted(true);
    setOpen(true);
  };

  /**
   * Search hands off to the jobs screen rather than filtering here.
   *
   * That screen already owns the query, the filters and the paging; a second
   * search that had to stay in step with it would be two sources of truth for
   * one question. Submitting empty still navigates — someone who opens search
   * and presses go wants the job list.
   */
  const submit = () => {
    const term = query.trim();
    router.push(
      term
        ? { pathname: '/(app)/jobs', params: { q: term } }
        : '/(app)/jobs',
    );
    close();
  };

  const faces = useMemo(
    () => ({
      front: {
        opacity: flip.interpolate({
          inputRange: [0, 0.5, 0.501, 1],
          outputRange: [1, 1, 0, 0],
        }),
        transform: [
          { perspective: 600 },
          {
            rotateX: flip.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: ['0deg', '90deg', '90deg'],
            }),
          },
        ],
      },
      back: {
        opacity: flip.interpolate({
          inputRange: [0, 0.499, 0.5, 1],
          outputRange: [0, 0, 1, 1],
        }),
        transform: [
          { perspective: 600 },
          {
            rotateX: flip.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: ['-90deg', '-90deg', '0deg'],
            }),
          },
        ],
      },
    }),
    [flip],
  );

  const words = (
    <FlipStack
      clock={clock}
      count={EXAMPLES.length}
      lift={8}
      style={styles.words}
      render={(i) => (
        <Text numberOfLines={1} style={[styles.word, { color: c.text }]}>
          “{EXAMPLES[i]}”
        </Text>
      )}
    />
  );

  return (
    <Animated.View style={[styles.shell, { right, width }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, faces.front]}
        pointerEvents={open ? 'none' : 'auto'}
      >
        <Pressable
          onPress={openSearch}
          accessibilityRole="button"
          accessibilityLabel={t('dash.searchJobs')}
          // Styled as the bell it sits beside.
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.bar,
            styles.round,
            {
              backgroundColor: c.surfaceAlt,
              borderColor: hovered ? c.primary : c.border,
            },
          ]}
        >
          <FlipStack
            clock={clock}
            count={EXAMPLES.length}
            lift={10}
            centered
            style={StyleSheet.absoluteFill}
            render={(i) =>
              i % 2 === 0 ? (
                <SearchIcon size={20} color={c.text} />
              ) : (
                <BriefcaseIcon size={20} color={c.text} />
              )
            }
          />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, faces.back]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <View
          style={[
            styles.bar,
            { backgroundColor: c.fieldBg, borderColor: c.primary },
          ]}
        >
          <SearchIcon size={18} color={c.primary} />

          <View style={styles.field}>
            {fieldMounted ? (
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={submit}
                // Leaving an empty search closes it; one with words in it
                // stays open so they are not lost to a stray tap.
                onBlur={() => {
                  if (!query.trim()) close();
                }}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Escape') close();
                }}
                returnKeyType="search"
                autoCorrect={false}
                style={[styles.input, NO_FOCUS_RING, { color: c.text }]}
                accessibilityLabel={t('dash.searchJobs')}
              />
            ) : null}

            {/* The placeholder, drawn rather than set, because a native
                placeholder cannot flip. Clicks go through to the field. */}
            {query ? null : (
              <View style={styles.hint} pointerEvents="none">
                <Text style={[styles.prefix, { color: c.textMuted }]}>
                  {t('dash.search')}
                </Text>
                {words}
              </View>
            )}
          </View>

          {showGo ? (
            <Pressable
              onPress={submit}
              accessibilityRole="button"
              accessibilityLabel={t('dash.search')}
              style={[styles.go, { backgroundColor: c.primary }]}
            >
              <ArrowIcon size={16} color={c.primaryText} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={close}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.close}
          >
            <CloseIcon size={16} color={c.textMuted} />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A stack of items that turn over one at a time, like the flaps of a
 * departure board.
 *
 * All of it hangs off one counting value rather than an index in state:
 * item `i` is face-on while the count sits at `i`, tips away over the top as
 * it moves on, and the next tips up from below. Nothing re-renders to change
 * word, so the native driver runs the whole loop off the JS thread.
 */
function FlipStack({
  clock,
  count,
  lift,
  centered = false,
  style,
  render,
}: {
  clock: Animated.Value;
  count: number;
  /** How far an item travels up or down as it turns, in points. */
  lift: number;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
  render: (i: number) => ReactNode;
}) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => flipStyle(clock, i, count, lift)),
    [clock, count, lift],
  );

  return (
    <View
      style={style}
      // Decoration: the control around it carries the label.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {items.map((item, i) => (
        <Animated.View
          key={i}
          style={[
            StyleSheet.absoluteFill,
            styles.flipItem,
            centered && styles.flipCentered,
            item,
          ]}
        >
          {render(i)}
        </Animated.View>
      ))}
    </View>
  );
}

function flipStyle(clock: Animated.Value, i: number, n: number, lift: number) {
  // The first item is shown at both ends of the count: at 0, and at `n`,
  // where the loop hands back to 0.
  if (i === 0) {
    const range = [0, 0.5, n - 0.5, n];
    return {
      opacity: clock.interpolate({
        inputRange: [0, 0.35, 0.5, n - 0.5, n - 0.35, n],
        outputRange: [1, 1, 0, 0, 1, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        { perspective: 300 },
        {
          translateY: clock.interpolate({
            inputRange: range,
            outputRange: [0, -lift, lift, 0],
            extrapolate: 'clamp',
          }),
        },
        {
          rotateX: clock.interpolate({
            inputRange: range,
            outputRange: ['0deg', '90deg', '-90deg', '0deg'],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }

  const range = [i - 0.5, i, i + 0.5];
  return {
    opacity: clock.interpolate({
      inputRange: [i - 0.5, i - 0.35, i + 0.35, i + 0.5],
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      { perspective: 300 },
      {
        translateY: clock.interpolate({
          inputRange: range,
          outputRange: [lift, 0, -lift],
          extrapolate: 'clamp',
        }),
      },
      {
        rotateX: clock.interpolate({
          inputRange: range,
          outputRange: ['-90deg', '0deg', '90deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
}

const styles = StyleSheet.create({
  // Anchored on the bell's side (`right`), so opening grows leftwards.
  shell: {
    position: 'absolute',
    top: 0,
    height: BAR_HEIGHT,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingLeft: 14,
    paddingRight: 8,
  },
  round: {
    paddingLeft: 0,
    paddingRight: 0,
    justifyContent: 'center',
  },

  prefix: { fontSize: font.sm, fontWeight: '500' },
  words: { flex: 1, height: 20 },
  word: { fontSize: font.sm, fontWeight: '700', lineHeight: 20 },
  flipItem: { justifyContent: 'center' },
  flipCentered: { alignItems: 'center' },

  field: { flex: 1, height: '100%', justifyContent: 'center' },
  input: { fontSize: font.sm, paddingVertical: 0, height: '100%' },
  hint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  go: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
