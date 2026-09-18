/**
 * Design tokens lifted from the supplied HTML mockups.
 *
 * The admin portal is deliberately orange (#ff6000) where the worker app is
 * green — the two are different products for different people, and a reviewer
 * glancing at a screen should never be unsure which one they are looking at.
 *
 * Light only, matching the mockups. Adding dark mode later means adding a
 * second palette here; nothing else reads raw hex values.
 */
export const colors = {
  // brand
  primary: '#ff6000',
  primaryDark: '#e05500',
  primarySoft: '#fff1e8',
  primaryText: '#ffffff',

  // surfaces
  bg: '#f8fafc',
  bgAlt: '#f1f5f9',
  surface: '#ffffff',
  surfaceAlt: '#f8f9fc',
  border: '#e5e7eb',
  borderLight: '#f1f5f9',

  // text
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',

  // semantic
  success: '#16a34a',
  successSoft: '#dcfce7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  warningText: '#92400e',
  info: '#3b82f6',
  infoSoft: '#dbeafe',

  // misc from the mockups
  dark: '#111827',
  chipBg: '#f3f4f6',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** One elevation, used consistently — the mockups only ever use a soft card lift. */
export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
