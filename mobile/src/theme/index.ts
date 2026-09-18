/**
 * Tokens lifted from the design frames' :root blocks.
 * The mockups drift slightly between files (#ff6b00 / #ff6600 / #ff6000); the
 * value below is the one used on the dashboard and job screens, applied
 * everywhere for consistency.
 */
export const colors = {
  background: '#F9AA1E',
  card: '#FFFFFF',
  border: '#F0C878',

  primary: '#1E3A5F',
  primarySoft: '#E8EEF4',
  onPrimary: '#FFFFFF',

  textDark: '#0F172A',
  textBody: '#1E293B',
  textGray: '#64748B',
  textLight: '#9CA3AF',

  red: '#EF4444',
  redBg: '#FEE2E2',
  redText: '#DC2626',

  green: '#10B981',
  greenBg: '#DCFCE7',
  greenText: '#16A34A',

  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  amberText: '#D97706',

  slate: '#334155',
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const text = {
  screenTitle: { fontSize: 22, fontWeight: '700' as const, color: colors.textDark },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: colors.textDark },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: colors.textDark },
  stat: { fontSize: 20, fontWeight: '700' as const, color: colors.textDark },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.textBody },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textDark },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textGray },
  micro: { fontSize: 11, fontWeight: '500' as const, color: colors.textLight },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/**
 * Status colours are looked up rather than branched on at each call site, so a
 * new status only has to be added here.
 */
export const statusPalette: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: colors.greenBg, fg: colors.greenText },
  APPROVED: { bg: colors.greenBg, fg: colors.greenText },
  COMPLETED: { bg: colors.greenBg, fg: colors.greenText },
  RESOLVED: { bg: colors.greenBg, fg: colors.greenText },
  VERIFIED: { bg: colors.greenBg, fg: colors.greenText },

  PENDING: { bg: colors.amberBg, fg: colors.amberText },
  IN_PROGRESS: { bg: colors.amberBg, fg: colors.amberText },
  ESCALATED: { bg: colors.amberBg, fg: colors.amberText },
  SHORTLISTED: { bg: colors.amberBg, fg: colors.amberText },

  REJECTED: { bg: colors.redBg, fg: colors.redText },
  SUSPENDED: { bg: colors.redBg, fg: colors.redText },
  FAILED: { bg: colors.redBg, fg: colors.redText },
  OPEN: { bg: colors.redBg, fg: colors.redText },

  CRITICAL: { bg: colors.redBg, fg: colors.redText },
  HIGH: { bg: '#FFEDD5', fg: '#C2410C' },
  MEDIUM: { bg: colors.amberBg, fg: colors.amberText },
  LOW: { bg: '#E2E8F0', fg: colors.slate },
};
