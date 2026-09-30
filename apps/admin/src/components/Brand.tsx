import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { BrandName } from './BrandName';

/**
 * The brand, as the worker app draws it.
 *
 * Both apps are WorkFlex BD to the same people — an employer who posts a job
 * in one and an admin who approves it in the other should not see two
 * different logos — so this panel now uses the worker app's own logotype and
 * its navy-and-orange mark rather than the bolt badge it arrived with.
 */

/** The logotype's colours: the navy of its W, the orange of its F. */
const NAVY = '#1E3A5F';
const NAVY_DARK = '#162C46';
const NAVY_LIGHT = '#274F7C';
const ORANGE = '#F97316';

/**
 * The square mark: a locator pin on a navy tile.
 *
 * The worker app animates this into a radar sweeping for nearby shifts. A
 * console needs a still logo in a header, so this is the same two shapes and
 * the same two colours, holding still.
 */
export function BrandMark({ size = 56 }: { size?: number }) {
  const { mode } = useTheme();
  const radius = size * 0.32;
  const pin = size * 0.52;

  return (
    <LinearGradient
      colors={mode === 'dark' ? [NAVY_LIGHT, NAVY_DARK] : [NAVY, NAVY_DARK]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tile, { width: size, height: size, borderRadius: radius }]}
    >
      <View style={[styles.sheen, { borderRadius: radius, height: size * 0.55 }]} />
      <Svg width={pin} height={pin} viewBox="0 0 24 24">
        {/* A map pin: the drop, with the hole punched by the even-odd rule. */}
        <Path
          d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
          fill={ORANGE}
        />
        <Circle cx={12} cy={9} r={2.6} fill={mode === 'dark' ? NAVY_DARK : NAVY} />
      </Svg>
    </LinearGradient>
  );
}

/**
 * "WorkFlex BD" as the worker app draws it — the traced logotype, not text
 * styled to look like one, so the letterforms match everywhere.
 *
 * `size` is the cap height the panel asked for; the logotype is taller than
 * its letters, so it renders a little above that to look the same weight.
 */
export function BrandWordmark({ size = 26 }: { size?: number }) {
  return <BrandName height={size * 1.25} accessibilityRole="image" />;
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
