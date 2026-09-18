import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Whether the reader is scrolling down the page right now.
 *
 * Exists for one reason: a floating button covers whatever is under it, and
 * on this dashboard that turned out to include the "View job" button on a
 * recommendation card — 43% of it, with the button on top, so a tap there hit
 * the wrong control. Every floating action button has this problem, and the
 * settled answer is to get out of the way while someone is reading downward
 * and come back when they stop or turn around.
 *
 * A module-level value rather than context: the button lives in the app shell
 * and the scroll happens inside whichever screen the shell is rendering, so
 * the two have no common ancestor to thread a provider through, and a context
 * spanning the shell would re-render every screen on every scroll frame.
 */
let scrollingDown = false;
const listeners = new Set<(down: boolean) => void>();

/** Pixels of movement before the button reacts. */
const THRESHOLD = 12;

/** How long after the last scroll event the button comes back. */
const SETTLE_MS = 220;

function publish(next: boolean) {
  if (next === scrollingDown) return;
  scrollingDown = next;
  listeners.forEach((fn) => fn(next));
}

/**
 * The scroll handler a tab screen attaches to its list or scroll view.
 *
 * Returned from a hook rather than exported as a bare function so each screen
 * gets its own `lastY` — two screens sharing one would see the second's first
 * scroll as an enormous jump from wherever the first happened to be left.
 */
export function useScrollDirectionHandler() {
  const lastY = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (settle.current) clearTimeout(settle.current);
      // Leaving a screen mid-scroll must not strand the button hidden on the
      // next one.
      publish(false);
    };
  }, []);

  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastY.current;

    if (Math.abs(delta) > THRESHOLD) {
      // Near the top there is nothing worth hiding for, and hiding there makes
      // the button flicker as a short page bounces.
      publish(delta > 0 && y > 80);
      lastY.current = y;
    }

    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => publish(false), SETTLE_MS);
  }, []);
}

/** Subscribes a component to the current direction. */
export function useScrollingDown(): boolean {
  const [down, setDown] = useState(scrollingDown);

  useEffect(() => {
    listeners.add(setDown);
    return () => {
      listeners.delete(setDown);
    };
  }, []);

  return down;
}
