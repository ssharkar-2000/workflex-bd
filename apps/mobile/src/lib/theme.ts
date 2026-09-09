/**
 * Colour system.
 *
 * A warm near-white page, white cards, and colour that has to earn its place.
 * Each hue owns one meaning: deep blue-purple is the brand and anything you
 * can act on, purple is anything the system computed, green is success, amber
 * is caution, red is a problem.
 *
 * The pastels are still here and still the same four hues, but they are
 * accents now rather than the default background of every section. They had
 * been cycled by list index — each job card taking the next colour along — so
 * a screen was a stripe of peach, mint, lavender and butter that meant
 * nothing. Colour that varies for no reason teaches people to ignore colour,
 * which is expensive: it is the same channel the app needs for "this is
 * urgent" and "this was verified". A tint now appears only where a difference
 * in colour marks a difference in kind — the two role cards, the activity
 * tiles, an avatar, a company monogram.
 *
 * Contrast is the accessibility constraint that actually matters, and it is
 * measured rather than judged: every pairing in this file clears WCAG AA
 * (4.5:1) in both modes. Neither mode pairs pure black with pure white, which
 * glares badly for older eyes, and text never sits on a mid-tone pastel,
 * because nothing readable can.
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

  /**
   * Anything the system worked out rather than recorded.
   *
   * Its own role, not a reuse of `primary`, because the two say different
   * things: primary means "this is the action", `ai` means "this figure was
   * computed and you can open the working". The match pill, the NextSkill
   * card and the explanation sheets are the only things entitled to it, so
   * seeing purple anywhere means a number with reasoning behind it.
   */
  ai: string;
  aiSoft: string;
  aiSoftBorder: string;

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
  // Very light warm white. The old page was a peach cream (#FBF4EE) strong
  // enough to read as its own colour, which left white cards floating on a
  // tinted field and made the pastel sections feel like more of the same. At
  // this value the page is a warm neutral and a white card sits on it as a
  // card.
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EEE9',
  border: '#E6E1DA',

  // Carries a trace of the primary's blue, so the darkest thing on screen
  // belongs to the same family as the brand rather than being neutral black.
  text: '#1A1A2E',
  textMuted: '#585873',

  textOnBrand: '#1A1A2E',
  textMutedOnBrand: 'rgba(26,26,46,0.68)',
  accentOnBrand: '#A3421C',

  // Deep blue-purple. The old primary was so near black that a filled button
  // read as a black rectangle and the brand had no colour of its own; this is
  // recognisably indigo while still clearing AA against white by a wide
  // margin.
  primary: '#3A34A0',
  primaryPressed: '#2B2680',
  primarySoft: '#EEEDFA',
  primarySoftBorder: '#C9C6EC',
  primaryText: '#FFFFFF',

  accent: '#FF8A4C',

  // A step round the wheel from primary — clearly purple beside the indigo,
  // rather than a shade of it that reads as the same colour twice.
  ai: '#6D28D9',
  aiSoft: '#F3EDFE',
  aiSoftBorder: '#D9C9F7',

  success: '#136B3A',
  successSoft: '#DCF0E4',
  // Amber rather than the old brown-gold: warm and unmistakably a caution,
  // and dark enough to be read as text on both the page and its own tint.
  warning: '#95610A',
  warningSoft: '#FDF1DC',
  warningBorder: '#F0D5A4',
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
   * The light mode indigo lifted, not swapped for a different hue.
   *
   * It used to be coral here, because the old primary was so dark that a
   * filled button vanished against a near-black page. A blue-purple can be
   * raised in lightness and stay itself, so both modes now share a brand
   * colour instead of the dark theme borrowing the accent.
   */
  primary: '#9E97F0',
  primaryPressed: '#8880E4',
  primarySoft: '#22203F',
  primarySoftBorder: '#3D3A66',
  primaryText: '#15132E',

  accent: '#FFAA79',

  ai: '#B9A6FA',
  aiSoft: '#241C3D',
  aiSoftBorder: '#3F3163',

  success: '#6BD1A0',
  successSoft: '#12302A',
  warning: '#FFC24D',
  warningSoft: '#33280F',
  warningBorder: '#5C4718',
  danger: '#FF8A82',
  dangerSoft: '#3A1B1A',
  dangerBorder: '#6B2E2A',

  // Lifted from #7A7A93, which measured 4.10:1 on the dark surface and so
  // failed AA as text. It labels the "Coming next" rows in the drawer and the
  // resend countdowns — the least important text on those screens, which is
  // exactly why it has to stay readable rather than fade into the card.
  locked: '#8E8BA6',

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
