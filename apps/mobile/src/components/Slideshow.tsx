import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useT } from '../i18n';
import { useReduceMotion } from '../lib/use-reduce-motion';
import { useTheme } from '../lib/use-theme';
import { radius, space } from '../lib/theme';

/** How long each card holds the screen, and how long it takes to leave. */
const HOLD_MS = 5_000;
const SLIDE_MS = 280;

/**
 * One card at a time, changing itself.
 *
 * Each item gets the full width for five seconds, then leaves to the right
 * while the next arrives from the left — so a row reads as one strip moving
 * in a single direction rather than cards appearing and vanishing in place.
 * It runs through every item and starts again.
 *
 * Three rules keep it from being the kind of carousel people hate:
 *
 * - Touch the dots and the rotation stops for good. The person has said
 *   which one they want to read, and a card sliding away mid-sentence is the
 *   whole complaint about carousels. It is also the pause that auto-moving
 *   content is required to have.
 * - `paused` holds it still while something on top depends on the card
 *   underneath — a sheet explaining the item it was opened from.
 * - Asked for less motion, it does not rotate at all: the items are stacked
 *   and still. An animation that runs on its own is exactly what that
 *   setting exists to stop.
 */
export function Slideshow<T>({
  items,
  keyOf,
  render,
  paused = false,
  gap = 12,
}: {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  /** Hold the rotation without ending it. */
  paused?: boolean;
  /** Spacing between cards in the reduced-motion stack. */
  gap?: number;
}) {
  const t = useT();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const [index, setIndex] = useState(0);
  /** Set once somebody picks a card themselves; the timer never runs again. */
  const [taken, setTaken] = useState(false);

  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  /** The hand-over from one card to the next, so it can be cancelled. */
  const turnover = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (next: number) => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: width,
          duration: SLIDE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: SLIDE_MS,
          useNativeDriver: true,
        }),
      ]).start();

      // The card changes on a timer rather than in the animation's completion
      // callback. An animation that is interrupted — a backgrounded tab, a
      // dropped frame on a cheap phone — never reports that it finished, and
      // a rotation waiting on that callback stops for good. The movement is
      // decoration; the turn has to happen either way.
      if (turnover.current) clearTimeout(turnover.current);
      turnover.current = setTimeout(() => {
        setIndex(next);
        // Put on the far side without animating, so the incoming card enters
        // from the left instead of springing back the way the last one went.
        slide.setValue(-width);
        Animated.parallel([
          Animated.timing(slide, {
            toValue: 0,
            duration: SLIDE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 1,
            duration: SLIDE_MS,
            useNativeDriver: true,
          }),
        ]).start();
      }, SLIDE_MS);
    },
    [fade, slide, width],
  );

  useEffect(() => {
    if (reduceMotion || paused || taken || items.length < 2) return;
    const timer = setTimeout(() => goTo((index + 1) % items.length), HOLD_MS);
    return () => clearTimeout(timer);
  }, [goTo, index, items.length, paused, reduceMotion, taken]);

  // Nothing should be mid-turn after this leaves the screen.
  useEffect(
    () => () => {
      if (turnover.current) clearTimeout(turnover.current);
    },
    [],
  );

  if (items.length === 0) return null;

  if (reduceMotion) {
    return (
      <View style={{ gap }}>
        {items.map((item) => (
          <View key={keyOf(item)}>{render(item)}</View>
        ))}
      </View>
    );
  }

  const item = items[index];
  if (!item) return null;

  return (
    <View>
      {/* Clipped, so the card on its way out does not paint over whatever
          sits above and below it. */}
      <View style={s.window}>
        <Animated.View
          style={{ transform: [{ translateX: slide }], opacity: fade }}
        >
          {render(item)}
        </Animated.View>
      </View>

      {items.length > 1 ? (
        <View style={s.dots}>
          {items.map((row, i) => (
            <Pressable
              key={keyOf(row)}
              onPress={() => {
                setTaken(true);
                if (i !== index) goTo(i);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={t('slides.goTo', {
                index: i + 1,
                total: items.length,
              })}
            >
              <View
                style={[
                  s.dot,
                  {
                    backgroundColor: i === index ? c.primary : c.border,
                    width: i === index ? 18 : 6,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  window: { overflow: 'hidden' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
  },
  // The current one is a bar rather than a bigger circle: at six pixels a
  // colour change alone is not enough to see which one you are on.
  dot: { height: 6, borderRadius: radius.pill },
});
