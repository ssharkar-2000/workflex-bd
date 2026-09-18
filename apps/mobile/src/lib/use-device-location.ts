import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from '@workflex/shared';

/**
 * The device's position, if the person is willing to share it.
 *
 * Asked for once, on mount, and never insisted upon. A refusal is a complete
 * answer: the caller falls back to the area in the registered address and the
 * screen still works, so there is no second prompt, no explanatory modal, and
 * no feature held hostage. Someone who does not want to be located on a job
 * board has a good reason and does not owe anyone an explanation.
 *
 * `status` is what the UI needs to be honest about the number it is showing:
 * distances measured from a GPS fix mean something different from distances
 * measured from the middle of a neighbourhood, and the card says which.
 */
export type LocationStatus =
  | 'asking'
  /** Granted and fixed. `position` is set. */
  | 'ready'
  /** Refused, unavailable, or timed out — all handled identically. */
  | 'unavailable';

export function useDeviceLocation(): {
  position: LatLng | null;
  status: LocationStatus;
} {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>('asking');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!granted) {
          setStatus('unavailable');
          return;
        }

        // Balanced accuracy, not the highest: this feeds a figure rounded to
        // one decimal of a kilometre, so the extra seconds and battery a
        // precise fix costs would buy nothing anyone can see.
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        setPosition({
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
        });
        setStatus('ready');
      } catch {
        // A browser with location blocked, a device with the radio off, a
        // timeout. None of them are worth distinguishing here: the caller has
        // exactly one fallback either way.
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { position, status };
}
