/**
 * Premium Job Portal / SaaS palette — now with a real dark variant (item 13).
 *
 * The previous tokens used a bright orange (#F9AA1E) as the full-screen
 * background with a near-matching tan border (#F0C878). That combination is
 * why outline buttons, dividers, and some chips visually "merged" into the
 * background across the app — the border and background colours were only a
 * few percent apart in luminance. The background is now a calm, neutral
 * slate-tinted off-white that every existing text/status colour below was
 * already designed against, so contrast is fixed everywhere this token is
 * used without changing layout. The brand orange is kept as `brand`/`accent`
 * for the one or two moments that should still pop (primary CTA, active tab).
 *
 * DARK MODE (item 13): colours now come in a `light`/`dark` pair. `colors`,
 * `text`, and `statusPalette` below are kept as-is (always the LIGHT
 * palette) so every screen that hasn't been migrated yet keeps compiling and
 * rendering exactly as before. Screens that want to react to the user's
 * theme choice should call `useTheme()` from `./ThemeContext` instead of
 * importing `colors`/`text` statically — see ThemeContext.tsx for the
 * migration pattern, and Settings/Menu/Dashboard/Navigation for worked
 * examples. See STATUS.md for exactly which screens have been migrated.
 */
export const lightColors = {
  background: '#F4F6FA',
  surface: '#EEF1F7',
  card: '#FFFFFF',
  border: '#E2E8F0',

  brand: '#F97316',
  brandSoft: '#FFEDD5',

  primary: '#1E3A5F',
  primarySoft: '#E8EEF4',
  onPrimary: '#FFFFFF',

  textDark: '#0F172A',
  textBody: '#1E293B',
  textGray: '#64748B',
  textLight: '#94A3B8',

  red: '#EF4444',
  redBg: '#FEE2E2',
  redText: '#DC2626',

  green: '#10B981',
  greenBg: '#DCFCE7',
  greenText: '#16A34A',

  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  amberText: '#B45309',

  slate: '#334155',
} as const;

/**
 * Dark palette — v2. The original version leaned on one near-black navy
 * (#0B1220) for the screen background, surface, and cards all sitting within
 * a few percent of each other in lightness, so every screen read as one flat
 * dark slab with little sense of elevation — "too dark" rather than premium.
 * This version keeps the same semantic slots and relative relationships
 * (card is still a visible step lighter than background, `*Text` colours
 * still pass contrast against `*Bg`) but widens the steps between
 * background → surface → card → border, and swaps the pale, slightly washed
 * accent blue for a richer, more saturated one so buttons and active states
 * actually pop instead of blending into the dark background.
 */
export const darkColors = {
  background: '#0B0E14',
  surface: '#141822',
  card: '#1C212E',
  border: '#323A4A',

  brand: '#FDA85C',
  brandSoft: '#3D2712',

  primary: '#5B8DEF',
  primarySoft: '#1C2A44',
  onPrimary: '#F8FAFC',

  textDark: '#F4F6FA',
  textBody: '#D6DCE5',
  textGray: '#9AA5B4',
  textLight: '#6B7686',

  red: '#F87171',
  redBg: '#3A1E20',
  redText: '#FCA5A5',

  green: '#4ADE80',
  greenBg: '#123526',
  greenText: '#86EFAC',

  amber: '#FBBF24',
  amberBg: '#3D2E0C',
  amberText: '#FDE68A',

  slate: '#CBD5E1',
} as const;

export type ThemeColors = typeof lightColors;

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
      shadowColor: mode === 'dark' ? '#000000' : '#0F172A',
      shadowOpacity: mode === 'dark' ? 0.4 : 0.05,
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
 * A palette of soft, muted "categorical" tints — deliberately separate from
 * the red/green/amber status palette above so a kind/type badge (e.g. a CMS
 * block's kind, a payment type, an alert kind) never gets visually confused
 * with a status pill (approved/pending/rejected). Each pair is tuned to sit
 * quietly on that theme's card/background instead of shouting.
 */
const lightCategoryPalette: { bg: string; fg: string }[] = [
  { bg: '#E0E7FF', fg: '#4338CA' }, // indigo
  { bg: '#CCFBF1', fg: '#0F766E' }, // teal
  { bg: '#FCE7F3', fg: '#BE185D' }, // rose
  { bg: '#E0F2FE', fg: '#0369A1' }, // sky
  { bg: '#EDE9FE', fg: '#6D28D9' }, // violet
  { bg: '#ECFCCB', fg: '#4D7C0F' }, // lime
];

const darkCategoryPalette: { bg: string; fg: string }[] = [
  { bg: '#312E81', fg: '#C7D2FE' }, // indigo
  { bg: '#134E4A', fg: '#99F6E4' }, // teal
  { bg: '#831843', fg: '#FBCFE8' }, // rose
  { bg: '#075985', fg: '#BAE6FD' }, // sky
  { bg: '#4C1D95', fg: '#DDD6FE' }, // violet
  { bg: '#3F6212', fg: '#D9F99D' }, // lime
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
