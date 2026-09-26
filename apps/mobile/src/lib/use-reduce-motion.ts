import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the person has asked their device for less motion.
 *
 * Decorative loops read this and hold still, because an animation that runs
 * on its own is exactly what the setting exists to stop. False until the
 * device answers, which takes a frame or two, so anything that started in
 * that gap has to be put back when it turns true.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
