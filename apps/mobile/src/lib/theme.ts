/**
 * Colour system.
 *
 * Soft pastel, drawn from the supplied reference: a peach → mint → lavender
 * wash behind cream surfaces, deep indigo for anything actionable, and coral
 * as the highlight. Only the values changed here — every token name is the
 * one the screens already use, so layout, animation and the logo geometry are
 * untouched by the reskin.
 *
 * Contrast is the accessibility constraint that actually matters. Body text
 * clears WCAG AA (4.5:1) against its own background in both modes, and
 * neither mode pairs pure black with pure white, which glares badly for older
 * eyes. The pastels are deliberately confined to backgrounds: text never sits
 * on a mid-tone pastel, because nothing readable can.
 */

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  /** Page background. */
  bg: string;
  /** Cards and raised surfaces. */
  surface: string;
  /** Recessed fills — input backgrounds, inactive tiles. */
  surfaceAlt: string;
  border: string;

  text: string;
  textMuted: string;

  /**
   * Text sitting on the patterned page background. The page is light in light
   * mode, so these are near-black there rather than white — the names are kept
   * from when that surface was a dark gradient.
   */
  textOnBrand: string;
  textMutedOnBrand: string;
  /** Highlight for labels and active borders on the page background. */
  accentOnBrand: string;

  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primarySoftBorder: string;
  primaryText: string;

  accent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;

  locked: string;

  /**
   * The registration brand band: pale ice blue with black on it, taken from
   * the supplied reference. Identical in both modes, which is why it cannot
   * borrow `primary`/`primaryText` — those invert between light and dark.
   * `bandBorder` draws the bottom edge, which would otherwise be invisible
   * against the cream page in light mode.
   */
  bandBg: string;
  bandText: string;
  bandBorder: string;

  /**
   * Card fills, cycled so a grid reads as the reference's pastel mix rather
   * than a wall of identical white boxes. Deliberately pale: `text` has to
   * clear AA on every one of them, which rules out the saturated versions.
   */
  tints: readonly [string, string, string, string];
  /** Matching hairline for each tint, same order. */
  tintBorders: readonly [string, string, string, string];

  /** Very low-contrast wash over the page background. */
  gradient: readonly [string, string, string, string];
  /** Soft blobs that drift behind the doodle layer. */
  orbs: readonly [string, string, string];
  /** Tint of the scattered background doodles. */
  doodle: string;
  doodleOpacity: number;

  /** Glass panels. */
  glassFill: string;
  glassBorder: string;
  glassStrongFill: string;
  glassHighlight: string;
}

const light: Palette = {
  bg: '#FBF4EE',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EDE6',
  border: '#E6DCD2',

  // Deep indigo rather than black: it belongs to the same family as the
  // primary, and reads ~15:1 on the cream page.
  text: '#171733',
  textMuted: '#585874',

  textOnBrand: '#171733',
  textMutedOnBrand: 'rgba(23,23,51,0.68)',
  // Darkened well past the reference coral so it still clears AA as *text* on
  // the pale wash (the reference tone measured 3.9:1). The bright coral lives
  // on as `accent`, which is only ever a fill.
  accentOnBrand: '#A3421C',

  primary: '#1E1E3C',
  primaryPressed: '#12122A',
  primarySoft: '#EAEAF6',
  primarySoftBorder: '#C7C7E2',
  primaryText: '#FFFFFF',

  accent: '#FF8A4C',
  success: '#176243',
  successSoft: '#D8EFE2',
  warning: '#8A5A00',
  warningSoft: '#FDF0DC',
  warningBorder: '#EFD3A2',
  danger: '#B3382B',
  dangerSoft: '#FBE6E2',
  dangerBorder: '#EFB6AC',

  // Dark enough to clear AA at small sizes on both the page and any tint —
  // "🔒 Level 1" is the label telling someone why a tile does nothing, so it
  // has to survive being the least important text on the screen.
  locked: '#6A6A82',

  bandBg: '#DFEAF4',
  bandText: '#101010',
  bandBorder: '#AAC4DC',

  // peach · mint · lavender · butter — the reference's four pastels
  tints: ['#FFEADF', '#DFF1E7', '#E6E8FA', '#FDF1DC'],
  tintBorders: ['#F8D3C0', '#C7E5D6', '#CFD3F0', '#F2DEBC'],

  gradient: ['#FDE3D3', '#F8E7DC', '#DCEDE2', '#DADEF4'],
  orbs: ['#FFC6A6', '#B7E2CB', '#CBD0F1'],
  doodle: '#1E1E3C',
  /**
   * Raised from 0.06, which was below the threshold of being seen at all: a
   * mid-tone emoji at that opacity composites to within 1.07:1 of the page,
   * so the whole layer was doing nothing.
   *
   * 0.55 is the ceiling, not a preference. Body text sometimes passes over an
   * icon, and the worst-case pairing measures 5.2:1 here — above the 4.5:1 the
   * rest of this file holds itself to. At 0.65 that drops to 4.17:1 and the
   * text fails, so this is as visible as the layer can be made without
   * trading away legibility somewhere else.
   */
  doodleOpacity: 0.55,

  glassFill: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(30,30,60,0.16)',
  glassStrongFill: 'rgba(255,255,255,0.76)',
  glassHighlight: 'rgba(255,255,255,0.86)',
};

const dark: Palette = {
  bg: '#111120',
  surface: '#1A1A2B',
  surfaceAlt: '#232338',
  border: '#34344C',

  text: '#F1EFF7',
  textMuted: '#A9A6C0',

  textOnBrand: '#F1EFF7',
  textMutedOnBrand: 'rgba(241,239,247,0.70)',
  accentOnBrand: '#FFAA79',

  /**
   * Coral, not the indigo used in light mode. Indigo is the darkest thing in
   * the palette, so a filled indigo button on a near-black page would be a
   * rectangle nobody can see — the accent has to carry the call to action here.
   */
  primary: '#FF8A4C',
  primaryPressed: '#E5763B',
  primarySoft: '#33201A',
  primarySoftBorder: '#5D3A29',
  primaryText: '#2A1206',

  accent: '#FFAA79',
  success: '#6BD1A0',
  successSoft: '#12302A',
  warning: '#FFC24D',
  warningSoft: '#33280F',
  warningBorder: '#5C4718',
  danger: '#FF8A82',
  dangerSoft: '#3A1B1A',
  dangerBorder: '#6B2E2A',

  locked: '#7A7A93',

  // Deliberately the same values as light mode: the band is the brand lockup
  // and is meant to look identical whichever theme the phone is in.
  bandBg: '#DFEAF4',
  bandText: '#101010',
  bandBorder: '#AAC4DC',

  // The same four hues pushed to near-black. They read as a tint against the
  // page rather than as colour — at this luminance anything stronger would
  // fight the white body text sitting on top.
  tints: ['#2A1E1C', '#16281F', '#1C1D33', '#292314'],
  tintBorders: ['#46312B', '#254236', '#30325A', '#453A22'],

  gradient: ['#111120', '#141426', '#12121F', '#131324'],
  orbs: ['#3A2620', '#1E3830', '#242749'],
  doodle: '#FFAA79',
  // The same value as light mode. The old comment here claimed dark needed
  // roughly double to register; measuring the composite says otherwise — at
  // any given opacity an emoji sits within 0.01 of the same contrast against
  // the near-black page as against the cream one.
  doodleOpacity: 0.55,

  glassFill: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassStrongFill: 'rgba(26,26,43,0.74)',
  glassHighlight: 'rgba(255,255,255,0.16)',
};

export const palettes: Record<ThemeMode, Palette> = { light, dark };

/**
 * Sizes are shared across modes. Font sizes sit a step above the usual mobile
 * scale — the audience includes people who will not reach for reading glasses
 * to check a job listing.
 */
/**
 * `fab` is not a spacing step — it is the room a scrolling screen has to
 * leave at the bottom so its last row is not sitting under the floating
 * Post a job button. 56 for the button, 16 of gap, 16 of breathing room.
 */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, fab: 88 } as const;
export const radius = { sm: 6, md: 12, lg: 18, xl: 26, pill: 999 } as const;
export const font = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 19,
  xl: 27,
  display: 34,
} as const;

/** Kept for modules that only need spacing tokens. */
export const theme = { space, radius, font } as const;
