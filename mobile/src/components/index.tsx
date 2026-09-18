import React from 'react';
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
import { colors, radii, shadow, spacing, statusPalette, text } from '../theme';

// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
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

/** Coloured pill used for every status in the design. */
export function StatusPill({ value, label }: { value: string; label?: string }) {
  const palette = statusPalette[value] ?? { bg: colors.border, fg: colors.textGray };
  return (
    <View style={[s.pill, { backgroundColor: palette.bg }]}>
      <Text style={[s.pillText, { color: palette.fg }]}>
        {label ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

/** Grey chip for skills, categories, and job meta. */
export function Chip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipText}>{label}</Text>
    </View>
  );
}

export function Avatar({ initials, size = 44 }: { initials: string; size?: number }) {
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
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

/** Horizontal progress meter — trust score, worker status breakdown. */
export function Meter({ percent, color = colors.primary }: { percent: number; color?: string }) {
  return (
    <View style={s.meterTrack}>
      <View
        style={[s.meterFill, { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }]}
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
  return (
    <View style={s.centered}>
      <Text style={s.errorText}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.centered}>
      <Text style={text.cardTitle}>{title}</Text>
      {hint ? <Text style={[text.caption, { marginTop: spacing.xs }]}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionAction: { ...text.caption, color: colors.primary, fontWeight: '600' },

  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.pill },
  pillText: { fontSize: 11, fontWeight: '700' },

  chip: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipText: { fontSize: 11, fontWeight: '500', color: colors.textGray },

  avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontWeight: '700' },

  button: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 14, fontWeight: '600' },

  tabs: { gap: spacing.sm, paddingVertical: spacing.sm },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textGray },
  tabTextActive: { color: colors.onPrimary },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  detailLabel: { ...text.caption, flexShrink: 0 },
  detailValue: { ...text.body, fontWeight: '500', flex: 1, textAlign: 'right' },

  meterTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: radii.pill },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  chartColumn: { flex: 1, justifyContent: 'flex-end' },
  chartBar: { borderRadius: radii.sm },
  chartLabels: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chartLabel: { ...text.micro, flex: 1, textAlign: 'center' },

  centered: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  errorText: { ...text.body, color: colors.redText, textAlign: 'center' },
});
