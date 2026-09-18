import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, space } from '../lib/theme';

/** Orange header bar + light body, the frame every mockup screen sits in. */
export function Screen({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneColor = {
    default: colors.text,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[tone];

  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export function Badge({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const [bg, fg] = {
    neutral: [colors.chipBg, colors.textMuted],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warningText],
    danger: [colors.dangerSoft, colors.danger],
    info: [colors.infoSoft, colors.info],
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = tone === 'primary';
  const isDanger = tone === 'danger';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isPrimary && { backgroundColor: colors.primary },
        isDanger && { backgroundColor: colors.danger },
        tone === 'outline' && styles.buttonOutline,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={tone === 'outline' ? colors.text : colors.primaryText}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: tone === 'outline' ? colors.text : colors.primaryText },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <View style={styles.retryWrap}>
          <Button label="Try again" onPress={onRetry} tone="outline" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.card,
  },

  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.card,
  },
  tileValue: { fontSize: font.xl, fontWeight: '800' },
  tileLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.xs, fontWeight: '700' },

  button: {
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: font.sm, fontWeight: '800' },

  empty: { padding: space.xl, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: font.sm },
  errorText: { color: colors.danger, fontSize: font.sm, textAlign: 'center' },
  retryWrap: { marginTop: space.md },
});
