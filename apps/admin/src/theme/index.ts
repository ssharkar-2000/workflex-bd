/**
 * Royal Blue & Gold.
 *
 * Four values were given — #0B2D5B, #1E63D6, #D4AF37 and #F8F7EF — and the
 * rest of this file is mixed from them. A console needs more than four
 * before anything has meant anything: a page, a card, a recessed fill and a
 * hairline are four on their own.
 *
 * How the four are used, and why:
 *
 * - #F8F7EF is the page. A warm off-white rather than white, so the navy
 *   text sits on it without the glare a console gets read on for an hour.
 * - #0B2D5B is the ink, and in dark mode the surface. It is the darkest of
 *   the four and therefore the one that can carry text.
 * - #1E63D6 is the action colour: buttons, links, the thing to press. One
 *   blue for one meaning, so a pressable is never in doubt.
 * - #D4AF37 is the accent. Gold is a decoration colour, not a text colour —
 *   at 1.9:1 on the cream page it fails every contrast threshold there is —
 *   so it draws rules, edges and marks, and where gold has to carry a word
 *   it is deepened to #8A6B12, which clears AA. The bright #D4AF37 from the
 *   palette appears as written in dark mode, where navy behind it gives it
 *   the contrast it needs.
 *
 * Three things are deliberately outside the palette.
 *
 * The wordmark and the logo keep their own colours. They are drawn in
 * BrandName/BrandMark with fixed values and read only the light/dark mode
 * from this file, so recolouring the console never touches the brand.
 *
 * And the status colours stay red, green and amber. This console is where
 * somebody approves a document, suspends an account or reads a failed
 * payment; a rejection drawn in blue beside an approval in blue is a console
 * that has to be read word by word. They are warmed to sit inside a navy and
 * gold scheme rather than shout across it.
 *
 * DARK MODE: colours come in a `light`/`dark` pair. `colors`, `text` and
 * `statusPalette` at the bottom of this file are the light palette, kept for
 * screens that import them statically; anything reacting to the theme calls
 * `useTheme()` from ./ThemeContext.
 */
export const lightColors = {
  background: '#F8F7EF',
  // A half-step down from the page, for recessed fills and table stripes.
  surface: '#F0EEE1',
  // White, so a card lifts off the cream. At the page's own value it would
  // be a rectangle you can only find by its border.
  card: '#FFFFFF',
  // Warm rather than grey: a neutral hairline on a cream page reads as dirt.
  border: '#E0DBC8',

  // The accent slot. Deepened from #D4AF37 — see the note on gold above.
  brand: '#8A6B12',
  brandSoft: '#F6EDD6',

  primary: '#1E63D6',
  primarySoft: '#E5EDFC',
  onPrimary: '#FFFFFF',

  textDark: '#0B2D5B',
  textBody: '#1C3E6E',
  // 4.9:1 on the page and 5.6:1 on a card, so the quietest text in the
  // console still clears AA.
  textGray: '#4A5F80',
  textLight: '#5E7396',

  red: '#B3261E',
  redBg: '#F7E5E2',
  redText: '#8C1D18',

  green: '#1F6B4C',
  greenBg: '#E2EFE8',
  greenText: '#1A5A40',

  // Kept clear of the gold accent above, so an amber status badge and a HIGH
  // priority badge are not the same colour with different words in them.
  amber: '#9A5B0F',
  amberBg: '#FAEADB',
  amberText: '#7A470B',

  slate: '#4A5F80',
} as const;

/**
 * Dark palette.
 *
 * Built downward from #0B2D5B rather than outward from black: the navy is
 * the surface, the page sits behind it, and cards sit in front, so depth is
 * shown by getting lighter in the direction the eye expects. Pure black was
 * not used — from #000 there is nowhere further down for a page to sit
 * behind a card.
 *
 * This is where the palette's gold appears exactly as given. On navy,
 * #D4AF37 reads at better than 7:1 and is the one place in the console where
 * gold can carry a word rather than only a line.
 */
export const darkColors = {
  background: '#071B36',
  surface: '#0B2D5B',
  card: '#123A6B',
  border: '#1E4B87',

  brand: '#D4AF37',
  brandSoft: '#33290F',

  // Lifted from #1E63D6, which sinks into the navy behind it.
  primary: '#5A92EE',
  primarySoft: '#14396C',
  onPrimary: '#06152B',

  textDark: '#F8F7EF',
  textBody: '#DCE5F2',
  textGray: '#A8BCD8',
  textLight: '#8399B8',

  red: '#F2B8B5',
  redBg: '#3E2320',
  redText: '#F2B8B5',

  green: '#9DD5B4',
  greenBg: '#16332A',
  greenText: '#9DD5B4',

  amber: '#EAC07E',
  amberBg: '#3A2A16',
  amberText: '#EAC07E',

  slate: '#A8BCD8',
} as const;

export type ThemeColors = { readonly [K in keyof typeof lightColors]: string };

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Builds the typography scale against a given palette. */
export function buildText(colors: ThemeColors) {
  return {
    screenTitle: { fontSize: 22, fontWeight: '700' as const, color: colors.textDark },
    sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: colors.textDark },
    cardTitle: { fontSize: 15, fontWeight: '600' as const, color: colors.textDark },
    stat: { fontSize: 20, fontWeight: '700' as const, color: colors.textDark },
    body: { fontSize: 14, fontWeight: '400' as const, color: colors.textBody },
    label: { fontSize: 13, fontWeight: '600' as const, color: colors.textDark },
    caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textGray },
    micro: { fontSize: 11, fontWeight: '500' as const, color: colors.textLight },
  } as const;
}

/** Builds the shadow tokens against a given palette (dark needs a stronger, less-transparent shadow to read at all). */
export function buildShadow(mode: 'light' | 'dark') {
  return {
    card: {
      // Navy rather than black in the light theme: a neutral shadow on a
      // cream page greys it, and the page is the warmest thing on screen.
      shadowColor: mode === 'dark' ? '#000000' : '#0B2D5B',
      shadowOpacity: mode === 'dark' ? 0.4 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  } as const;
}

/**
 * Status colours are looked up rather than branched on at each call site, so a
 * new status only has to be added here.
 */
export function buildStatusPalette(colors: ThemeColors): Record<string, { bg: string; fg: string }> {
  return {
    ACTIVE: { bg: colors.greenBg, fg: colors.greenText },
    APPROVED: { bg: colors.greenBg, fg: colors.greenText },
    COMPLETED: { bg: colors.greenBg, fg: colors.greenText },
    RESOLVED: { bg: colors.greenBg, fg: colors.greenText },
    VERIFIED: { bg: colors.greenBg, fg: colors.greenText },

    PENDING: { bg: colors.amberBg, fg: colors.amberText },
    IN_PROGRESS: { bg: colors.amberBg, fg: colors.amberText },
    ESCALATED: { bg: colors.amberBg, fg: colors.amberText },
    SHORTLISTED: { bg: colors.amberBg, fg: colors.amberText },
    EXPIRED: { bg: colors.amberBg, fg: colors.amberText },

    REJECTED: { bg: colors.redBg, fg: colors.redText },
    SUSPENDED: { bg: colors.redBg, fg: colors.redText },
    FAILED: { bg: colors.redBg, fg: colors.redText },
    OPEN: { bg: colors.redBg, fg: colors.redText },
    CANCELLED: { bg: colors.redBg, fg: colors.redText },

    CRITICAL: { bg: colors.redBg, fg: colors.redText },
    HIGH: { bg: colors.brandSoft, fg: colors.brand },
    MEDIUM: { bg: colors.amberBg, fg: colors.amberText },
    LOW: { bg: colors.border, fg: colors.slate },
  };
}

/**
 * Tints for a kind or a type — a CMS block's kind, a payment type, an alert
 * kind — kept apart from the red/green/amber status palette so a type badge
 * is never mistaken for an approval.
 *
 * Six steps between the palette's own blue and gold rather than six hues.
 * They separate one kind from the next on a screen, which is all they were
 * for; the word inside the badge is what says which kind it is, and a lime
 * chip beside a rose one would be the loudest thing in the console.
 */
const lightCategoryPalette: { bg: string; fg: string }[] = [
  { bg: '#E5EDFC', fg: '#0B2D5B' },
  { bg: '#D8E4F8', fg: '#0B2D5B' },
  { bg: '#F6EDD6', fg: '#5C470C' },
  { bg: '#EFE6CC', fg: '#5C470C' },
  { bg: '#EDF0F6', fg: '#1C3E6E' },
  { bg: '#E2E6EF', fg: '#1C3E6E' },
];

const darkCategoryPalette: { bg: string; fg: string }[] = [
  { bg: '#14396C', fg: '#DCE5F2' },
  { bg: '#1A4379', fg: '#DCE5F2' },
  { bg: '#33290F', fg: '#EAC07E' },
  { bg: '#3D3113', fg: '#EAC07E' },
  { bg: '#102C55', fg: '#A8BCD8' },
  { bg: '#173963', fg: '#A8BCD8' },
];

export function buildCategoryPalette(mode: 'light' | 'dark') {
  return mode === 'dark' ? darkCategoryPalette : lightCategoryPalette;
}

/**
 * Deterministically picks one tint from a category palette for a given key
 * (a kind/type string), so the same kind always gets the same colour on
 * every screen and every app run, without hand-maintaining a map per enum.
 */
export function categoryTint(
  palette: { bg: string; fg: string }[],
  key: string,
): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

// ---------------------------------------------------------------------------
// Backward-compatible static (always-light) exports. Existing, not-yet-
// migrated screens import these directly and are unaffected by theme
// switching — see the module docblock above.
// ---------------------------------------------------------------------------
export const colors = lightColors;
export const text = buildText(colors);
export const shadow = buildShadow('light');
export const statusPalette = buildStatusPalette(colors);
export const categoryPalette = buildCategoryPalette('light');
