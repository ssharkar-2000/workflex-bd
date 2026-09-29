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
   * The registration brand band: a warm peach with black on it, by request
   * the tone of the page's own wash behind the landing screen (it was a pale
   * ice blue, which is now the forms' colour). Identical in both modes, which
   * is why it cannot borrow `primary`/`primaryText` — those invert between
   * light and dark. `bandBorder` draws the edge below it, which would
   * otherwise be lost against the cream page in light mode.
   */
  bandBg: string;
  bandText: string;
  bandBorder: string;

  /**
   * The panel every form sits on — sign-in, the code check, password reset
   * and each registration step. In light mode it is the reference's pale ice
   * blue. It is not fixed across modes: the forms' text turns light in dark
   * mode, so there the panel keeps the hue at a depth light text can sit on.
   */
  formBg: string;
  formBorder: string;

  /**
   * Inside every box a person types into, on a form panel or a card alike.
   * Solid, never the colour behind showing through: white in light mode, by
   * request, and in dark mode the raised dark fill the app's fields already
   * had, since a white box there would hide the light text typed into it.
   */
  fieldBg: string;

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

  // The peach of the page's own wash, sampled from it (#FBDFCF on average).
  // The black on it measures 15.0:1; the edge is a step deeper so the band
  // still ends visibly against the cream page (1.7:1).
  bandBg: '#FBDFCF',
  bandText: '#101010',
  bandBorder: '#E8B696',

  // The reference's pale ice blue. On it body text measures 14.0:1, muted
  // text 5.4:1, links 5.1:1 and the Register link 7.9:1. It is only 1.15:1
  // from the page, so a deeper ice-blue border outlines the form.
  formBg: '#DFEAF4',
  formBorder: '#AAC4DC',

  // White, by request, so a field reads as a blank to fill in (text 17.1:1).
  // On a white card its border is what marks it out.
  fieldBg: '#FFFFFF',

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

/**
 * The dark palette.
 *
 * Nothing here is black. Near-white text on pure black measures 18.4:1,
 * which sounds like a virtue and is not: above roughly 15:1 the letters
 * halate — their edges smear — on the OLED screens most of this market
 * carries. Black is also the one background a surface cannot sit behind,
 * because depth in the dark is shown by getting lighter, and from black
 * there is nowhere further down to go.
 *
 * The dark it uses instead carries a trace of the brand's indigo. That is
 * what lets the orange accent read as an accent: against a hueless grey the
 * same orange looks like a colour cast rather than a choice.
 *
 * Measured against this page: body text 15.8:1, muted text 7.6:1, the accent
 * 9.7:1 and primary 7.0:1 — all far above the 4.5:1 this file holds body
 * text to, with room left for two more surface levels above the page.
 */
const dark: Palette = {
  bg: '#15142A',
  surface: '#1E1D36',
  surfaceAlt: '#262544',
  border: '#383757',

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
  primarySoft: '#252342',
  primarySoftBorder: '#3D3A66',
  primaryText: '#15132E',

  accent: '#FFAA79',

  ai: '#B9A6FA',
  aiSoft: '#271F40',
  aiSoftBorder: '#3F3163',

  success: '#6BD1A0',
  successSoft: '#15332D',
  warning: '#FFC24D',
  warningSoft: '#362B12',
  warningBorder: '#5C4718',
  danger: '#FF8A82',
  dangerSoft: '#3D1E1D',
  dangerBorder: '#6B2E2A',

  // Lifted from #7A7A93, which measured 4.10:1 on the dark surface and so
  // failed AA as text. It labels the "Coming next" rows in the drawer and the
  // resend countdowns — the least important text on those screens, which is
  // exactly why it has to stay readable rather than fade into the card.
  locked: '#8E8BA6',

  // Deliberately the same values as light mode: the band is the brand lockup
  // and is meant to look identical whichever theme the phone is in.
  bandBg: '#FBDFCF',
  bandText: '#101010',
  bandBorder: '#E8B696',

  // The ice blue's hue taken down to where light text reads on it: body text
  // 12.7:1, muted text 7.0:1, links 7.8:1, the Register link 5.6:1. Like the
  // light panel it sits close to the page, so it keeps an edge of its own.
  formBg: '#1E2A3B',
  formBorder: '#34465E',

  // The raised dark fill the app's fields already had in dark mode, where
  // white would hide the light text typed in (13.5:1 on it). It sits close
  // to the form and the cards, so each field's border marks it out.
  fieldBg: '#232338',

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
 * Terracotta & Beige — the brand palette, used from the dashboard onwards.
 *
 * Four colours were given: terracotta #B5523C, tan #D98B5A, beige #E8D5C4 and
 * cream #F9F5EC. Four cannot dress an interface on their own — a page, a card,
 * a recessed field and a hairline are four values before any colour has
 * meant anything — so the neutrals here are mixed from the beige and the
 * cream, and nothing steps outside that family.
 *
 * Text is pure black, as asked. Everywhere a second level of text was a
 * different grey it is now the same black at lower opacity, which keeps the
 * hierarchy without introducing a colour that is not in the palette.
 *
 * Two places keep a hue from outside it, and both are deliberate. Red has to
 * stay red: this palette's own terracotta is already a red-orange, so a
 * warning drawn in it would be indistinguishable from an ordinary button, and
 * "missed" on the calendar has to read as wrong at a glance. Green does the
 * same job for success. Both are pulled towards the earth tones as far as
 * they can go while staying unmistakable.
 *
 * The sign-in flow does not use any of this — see palette-set.ts.
 */
const brandLight: Palette = {
  // The page is a shade deeper than the cream so a cream card lifts off it;
  // at the same value the card would disappear into the background.
  bg: '#F4EBDE',
  surface: '#F9F5EC',
  surfaceAlt: '#E8D5C4',
  border: '#DCC6B0',

  text: '#000000',
  textMuted: 'rgba(0,0,0,0.62)',

  textOnBrand: '#000000',
  textMutedOnBrand: 'rgba(0,0,0,0.65)',
  accentOnBrand: '#8F3D2B',

  /**
   * The blue from the welcome screen's button, by request, rather than the
   * palette's own terracotta.
   *
   * `primary` is not only buttons — it is everything you can act on, so the
   * active tab, the links and the selected chips follow the buttons into
   * blue. That is the point: one colour means "press this" everywhere, and
   * splitting it would leave a page where some blue things are pressable and
   * some terracotta things are too.
   *
   * The terracotta has not gone anywhere. It is the page, the cards, the
   * beige fills and `accent` — the app still reads as the palette that was
   * given, with its actions in a colour that stands apart from it.
   */
  primary: '#3A34A0',
  primaryPressed: '#2B2680',
  primarySoft: '#EDECF8',
  primarySoftBorder: '#C5C2E8',
  // White on this blue measures 9.7:1; black on it fails at 3.1:1. The
  // instruction about black text is about the text of the app, not the label
  // inside a filled button, and an unreadable button is not what it asked for.
  primaryText: '#FFFFFF',

  accent: '#D98B5A',

  // Muted violet: the one thing on screen that has to say "a machine worked
  // this out" rather than "you can press this", which no shade of the brand
  // can say while the brand is what every button is drawn in.
  ai: '#6E4B8F',
  aiSoft: '#F0E9F6',
  aiSoftBorder: '#D6C6E6',

  success: '#3F6B4A',
  successSoft: '#E4EDE3',
  warning: '#9A6A16',
  warningSoft: '#F7EAD3',
  warningBorder: '#E4CFA3',
  // A true red rather than a deeper terracotta, which at a glance would be
  // the primary colour again.
  danger: '#A4161A',
  dangerSoft: '#F8E0DC',
  dangerBorder: '#E5B4AC',

  locked: 'rgba(0,0,0,0.48)',

  bandBg: '#E8D5C4',
  bandText: '#000000',
  bandBorder: '#D0B296',

  formBg: '#F2E9DC',
  formBorder: '#DCC6B0',

  // Near-white, so a box to type in still reads as a blank on a beige page.
  fieldBg: '#FFFDF9',

  // Four fills for cards that are meant to differ in kind. Within one family
  // and all pale, because black body text sits on every one of them.
  tints: ['#F8E4D8', '#F3E5CE', '#EBE1D3', '#F2E7DA'],
  tintBorders: ['#E8C7B4', '#E2CDA9', '#D8C9B4', '#E3D4C0'],

  gradient: ['#F7EDE1', '#F4E7D9', '#F0E6DA', '#F9F5EC'],
  orbs: ['#E8C3A8', '#DEC9B4', '#F0DFCB'],
  doodle: '#3A2A20',
  doodleOpacity: 0.55,

  glassFill: 'rgba(255,253,248,0.55)',
  glassBorder: 'rgba(58,42,32,0.16)',
  glassStrongFill: 'rgba(255,253,248,0.78)',
  glassHighlight: 'rgba(255,255,255,0.86)',
};

/**
 * The same palette after dark.
 *
 * Pure black text cannot survive here — on a dark page it is invisible — so
 * the cream takes its place, which keeps the text inside the four colours
 * given rather than reaching for a white that is not one of them. The
 * terracotta and the tan are lifted for the same reason every dark theme
 * lifts its brand: at their daylight values they read as brown smudges.
 */
const brandDark: Palette = {
  bg: '#1E1611',
  surface: '#2A201A',
  surfaceAlt: '#382A22',
  border: '#4A382C',

  text: '#F9F5EC',
  textMuted: 'rgba(249,245,236,0.70)',

  textOnBrand: '#F9F5EC',
  textMutedOnBrand: 'rgba(249,245,236,0.70)',
  accentOnBrand: '#E8A87C',

  // The same move as light mode: actions take the brand blue, lifted to
  // where it reads on a dark page, while the page itself stays warm.
  primary: '#9E97F0',
  primaryPressed: '#8880E4',
  primarySoft: '#282444',
  primarySoftBorder: '#433D6E',
  primaryText: '#15132E',

  accent: '#E8A87C',

  ai: '#B79BD9',
  aiSoft: '#2B2338',
  aiSoftBorder: '#453763',

  success: '#7BC79A',
  successSoft: '#1B2E22',
  warning: '#E8B667',
  warningSoft: '#33260F',
  warningBorder: '#5A431B',
  danger: '#F08A7C',
  dangerSoft: '#3A1E18',
  dangerBorder: '#6B332A',

  locked: 'rgba(249,245,236,0.55)',

  // The band is the brand lockup and looks the same in both modes.
  bandBg: '#E8D5C4',
  bandText: '#000000',
  bandBorder: '#D0B296',

  formBg: '#2A211B',
  formBorder: '#46362B',

  fieldBg: '#2F251E',

  tints: ['#33231C', '#2E2519', '#2A231C', '#302A20'],
  tintBorders: ['#4E3529', '#4A3C24', '#443A2D', '#4A4132'],

  gradient: ['#1A1310', '#1E1611', '#221913', '#1C1512'],
  orbs: ['#4A3226', '#3A2D20', '#2E241C'],
  doodle: '#E8A87C',
  doodleOpacity: 0.55,

  glassFill: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassStrongFill: 'rgba(30,22,17,0.74)',
  glassHighlight: 'rgba(255,255,255,0.16)',
};

export const brandPalettes: Record<ThemeMode, Palette> = {
  light: brandLight,
  dark: brandDark,
};

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
