import { useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../lib/use-theme';

/**
 * The WorkFlex BD logotype, taken from the brand artwork itself.
 * The WorkFlex BD logotype.
 *
 * Every outline here was traced from the artwork: the W — a folded ribbon
 * that starts in a pointed tail, with a round head over its middle so it
 * reads as a person with raised arms, and its last stroke rising into a
 * growth arrow — then "ork", "Flex", and BD. The W, its head and "Flex" are
 * filled with the artwork's own colours (`FILL`, the artwork with its navy
 * background taken out), cut to those outlines: the edges come from the
 * vectors, so they stay crisp at any size, and the ribbon keeps its real
 * shading rather than an imitation of it.
 * The letter shapes are traced from the brand artwork: the W — a folded
 * ribbon that starts in a pointed tail, with a round head over its middle so
 * it reads as a person with raised arms, and its last stroke rising into a
 * growth arrow — then "ork", "Flex" and BD.
 *
 * One change from the artwork, by request: its cyan is navy blue here — the
 * W's bright faces, its head and arrow, the F and l. Only that band of hues
 * moved; the blues, violet and purple are the artwork's. Deep navy would sink
 * into a dark screen, so the fill for dark screens uses a brighter navy.
 * The colours are the brand's own three, the same ones the admin panel uses:
 * the W in navy, "ork" and "lex" in slate, and the F and BD in orange. BD used
 * to sit white on a green pill with a red dot; it is plain orange letters now,
 * matching the reference the brand was given.
 *
 * "ork" is white in the artwork, which is drawn on navy. On a light screen
 * white letters would vanish, so there they are the app's dark ink instead —
 * the usual light-background version of a logo.
 * On a dark screen the navy and the slate are lifted, because the reference's
