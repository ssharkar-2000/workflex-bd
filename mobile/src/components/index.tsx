import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useI18n } from '../i18n/I18nContext';
import { buildText, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

// ---------------------------------------------------------------------------
// Item 13 (dark mode): every component here reads live colours from
// useTheme() and builds its StyleSheet per-render (memoized on the palette),
// instead of the old pattern of a module-level `StyleSheet.create` baked
// against a static `colors` import. Because this file backs almost every
// screen (Card, Button, StatusPill, Chip, Loading, ErrorState, EmptyState,
// FilterTabs, DetailRow, Meter, BarChart, Avatar, SectionHeader), fixing it
// here is what makes the app's shared chrome react to the theme toggle even
// on screens that haven't been individually migrated yet.
// ---------------------------------------------------------------------------

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionAction: { ...text.caption, color: colors.primary, fontWeight: '600' },

    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    pillText: { fontSize: 11, fontWeight: '700' },

    chip: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    chipText: { fontSize: 11, fontWeight: '500', color: colors.textGray },

    avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.onPrimary, fontWeight: '700' },

    button: {
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      flexGrow: 1,
    },
    buttonOutline: { borderWidth: 1, borderColor: colors.border },
    buttonText: { fontSize: 14, fontWeight: '600' },

    tabs: { gap: 8, paddingVertical: 8 },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textGray },
    tabTextActive: { color: colors.onPrimary },

    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 16,
    },
    detailLabel: { ...text.caption, flexShrink: 0 },
    detailValue: { ...text.body, fontWeight: '500', flex: 1, textAlign: 'right' },

    meterTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    meterFill: { height: '100%', borderRadius: 999 },

    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    chartColumn: { flex: 1, justifyContent: 'flex-end' },
    chartBar: { borderRadius: 8 },
    chartLabels: { flexDirection: 'row', gap: 8, marginTop: 8 },
    chartLabel: { ...text.micro, flex: 1, textAlign: 'center' },

    centered: { padding: 28, alignItems: 'center', gap: 12 },
    errorText: { ...text.body, color: colors.redText, textAlign: 'center' },
    backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, alignSelf: 'flex-start' },
    backChevron: { fontSize: 24, lineHeight: 24, color: colors.textGray, marginRight: 2 },
    backLabel: { ...text.caption },
  });
}

/** Shared hook: current theme colours/typography plus a memoized StyleSheet for this file. */
function useThemed() {
  const { colors, text } = useTheme();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  return { colors, text, s };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

/**
 * Every screen in this app builds its own header (the whole stack runs with
 * `headerShown: false` — see navigation/index.tsx) so none of them got a
 * back button for free from react-navigation. Most pushed screens had no way
 * back at all except the Android hardware button; iOS had none. Drop this at
 * the top of any pushed screen's content to fix that consistently.
 */
export function BackButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const { s } = useThemed();
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={s.backButton}>
      <Text style={s.backChevron}>‹</Text>
      <Text style={s.backLabel}>{label ?? t('common.back')}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { s } = useThemed();
  const { shadow } = useTheme();
  return <View style={[s.card, shadow.card, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { s, text } = useThemed();
  return (
    <View style={s.sectionHeader}>
      <Text style={text.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Every raw status/severity enum value that ever reaches a StatusPill,
 * mapped to a translation key. Without this, screens that don't pass an
 * explicit `label` fell back to the raw English enum (`value.charAt(0) + ...`
 * below) no matter which language was selected — that's why switching to
 * Bangla still showed "Pending", "Approved", "Open", etc. all over the app.
 * Centralising the lookup here fixes every call site at once instead of
 * requiring each of the ~20 screens that render a StatusPill to remember to
 * pass a translated label.
 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'status.active',
  PENDING: 'status.pending',
  APPROVED: 'status.approved',
  REJECTED: 'status.rejected',
  SUSPENDED: 'status.suspended',
  APPLIED: 'status.applied',
  SHORTLISTED: 'status.shortlisted',
  HIRED: 'status.hired',
  COMPLETED: 'status.completed',
  FAILED: 'status.failed',
  CRITICAL: 'status.critical',
  HIGH: 'status.high',
  MEDIUM: 'status.medium',
  LOW: 'status.low',
  OPEN: 'status.open',
  ESCALATED: 'status.escalated',
  RESOLVED: 'status.resolved',
  IN_PROGRESS: 'status.inProgress',
  CLOSED: 'status.closed',
  PRESENT: 'status.present',
  LATE: 'status.late',
  ABSENT: 'status.absent',
  ON_LEAVE: 'status.onLeave',
  VERIFIED: 'status.verified',
  UNVERIFIED: 'status.unverified',
  EXPIRED: 'status.expired',
  CANCELLED: 'status.cancelled',
};

/** Coloured pill used for every status in the design. */
export function StatusPill({ value, label }: { value: string; label?: string }) {
  const { s, colors } = useThemed();
  const { statusPalette } = useTheme();
  const { t } = useI18n();
  const palette = statusPalette[value] ?? { bg: colors.border, fg: colors.textGray };
  const key = STATUS_LABEL_KEYS[value];
  const fallback = value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <View style={[s.pill, { backgroundColor: palette.bg }]}>
      <Text style={[s.pillText, { color: palette.fg }]}>{label ?? (key ? t(key) : fallback)}</Text>
    </View>
  );
}

/** Grey chip for skills, categories, and job meta. */
export function Chip({ label }: { label: string }) {
  const { s } = useThemed();
  return (
    <View style={s.chip}>
      <Text style={s.chipText}>{label}</Text>
    </View>
  );
}

export function Avatar({ initials, size = 44 }: { initials: string; size?: number }) {
  const { s } = useThemed();
  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'success';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { s, colors } = useThemed();
  const isDisabled = disabled || loading;
  const fill = {
    primary: colors.primary,
    danger: colors.red,
    success: colors.greenText,
    outline: 'transparent',
  }[variant];
  const fg = variant === 'outline' ? colors.textBody : colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: fill },
        variant === 'outline' && s.buttonOutline,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Horizontal filter row: "All · Active · Pending · Suspended" with counts. */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { s } = useThemed();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.tabs}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[s.tab, active && s.tabActive]}
          >
            <Text style={[s.tabText, active && s.tabTextActive]}>
              {option.label}
              {option.count !== undefined ? ` ${option.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Label/value row used across the profile and detail screens. */
export function DetailRow({ label, value }: { label: string; value: string }) {
  const { s } = useThemed();
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

/** Horizontal progress meter — trust score, worker status breakdown. */
export function Meter({ percent, color }: { percent: number; color?: string }) {
  const { s, colors } = useThemed();
  return (
    <View style={s.meterTrack}>
      <View
        style={[
          s.meterFill,
          { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color ?? colors.primary },
        ]}
      />
    </View>
  );
}

/** Simple bar chart. The design's charts are bar series, so no chart library. */
export function BarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const { s, colors } = useThemed();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View>
      <View style={[s.chart, { height }]}>
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={s.chartColumn}>
            <View
              style={[
                s.chartBar,
                {
                  height: Math.max(4, (d.value / max) * (height - 8)),
                  backgroundColor: i === data.length - 1 ? colors.primary : colors.primarySoft,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={s.chartLabels}>
        {data.map((d, i) => (
          <Text key={`${d.label}-label-${i}`} style={s.chartLabel}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function Loading() {
  const { s, colors } = useThemed();
  return (
    <View style={s.centered}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

/**
 * Errors say what happened and what to do next, per the design's tone —
 * no apologies, no vague "oops".
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { s } = useThemed();
  const { t } = useI18n();
  return (
    <View style={s.centered}>
      <Text style={s.errorText}>{message}</Text>
      {onRetry ? <Button label={t('common.tryAgain')} variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const { s, text } = useThemed();
  return (
    <View style={s.centered}>
      <Text style={text.cardTitle}>{title}</Text>
      {hint ? <Text style={[text.caption, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}
