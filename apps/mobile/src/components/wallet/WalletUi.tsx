import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/**
 * The pieces the money screens share: a titled page with Back, an amount
 * field with the taka sign, labelled fields, choice chips and notices.
 *
 * They follow the post-a-job form rather than inventing a second style —
 * someone who has posted a job has already learned how these look.
 */

export function MoneyScreen({
  title,
  subtitle,
  children,
  footer,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the scrolling content — the screen's main action. */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(app)/home')
          }
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={[styles.back, { color: c.primary }]}>← {t('common.back')}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={c.primary}
              />
            ) : undefined
          }
        >
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>
          ) : null}
          {children}
        </ScrollView>

        {footer ? (
          <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bg }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function Label({ text, optional }: { text: string; optional?: boolean }) {
  const t = useT();
  const { c } = useTheme();
  return (
    <Text style={[styles.label, { color: c.text }]}>
      {text}
      {optional ? (
        <Text style={[styles.optional, { color: c.textMuted }]}>
          {'  '}
          {t('ob.optionalField')}
        </Text>
      ) : null}
    </Text>
  );
}

/** A whole-taka amount. Digits only; the taka sign is drawn, not typed. */
export function MoneyInput({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.group}>
      <Label text={label} />
      <View
        style={[
          styles.moneyBox,
          {
            backgroundColor: c.fieldBg,
            borderColor: invalid ? c.danger : c.border,
          },
        ]}
      >
        <Text style={[styles.taka, { color: c.textMuted }]}>৳</Text>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^\d]/g, '').slice(0, 7))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={c.textMuted}
          accessibilityLabel={label}
          style={[styles.moneyInput, { color: c.text }]}
        />
      </View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  optional,
  keyboardType,
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const { c } = useTheme();
  return (
    <View style={styles.group}>
      <Label text={label} optional={optional} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        style={[
          styles.input,
          { backgroundColor: c.fieldBg, borderColor: c.border, color: c.text },
        ]}
      />
    </View>
  );
}

export function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[
        styles.chip,
        {
          backgroundColor: on ? c.primarySoft : c.surfaceAlt,
          borderColor: on ? c.primary : c.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: c.text }]}>
        {on ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

/** A boxed message. `warning` for things to know, `danger` for problems. */
export function Notice({
  tone,
  title,
  body,
  children,
}: {
  tone: 'info' | 'warning' | 'success' | 'danger';
  title?: string;
  body?: string;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  const [bg, border, ink] = {
    info: [c.surfaceAlt, c.border, c.text],
    warning: [c.warningSoft, c.warningBorder, c.warning],
    success: [c.successSoft, c.success, c.success],
    danger: [c.dangerSoft, c.dangerBorder, c.danger],
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: border }]}>
      {title ? <Text style={[styles.noticeTitle, { color: ink }]}>{title}</Text> : null}
      {body ? (
        <Text style={[styles.noticeBody, { color: tone === 'info' ? c.textMuted : c.text }]}>
          {body}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** An outlined button, for the second action beside a ShimmerButton. */
export function OutlineButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.outline,
        { borderColor: c.primary, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.outlineText, { color: c.primary }]}>{label}</Text>
    </Pressable>
  );
}

export const walletStyles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { fontSize: font.sm, fontWeight: '700' },
  scroll: { padding: space.md, paddingBottom: space.xl },
  title: { fontSize: font.xl, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },
  footer: { paddingHorizontal: space.md, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1 },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, marginTop: space.md },

  group: { marginBottom: 16 },
  label: { fontSize: font.sm, fontWeight: '700', marginBottom: 8 },
  optional: { fontSize: font.xs, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: font.md,
  },
  moneyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 52,
  },
  taka: { fontSize: font.lg, fontWeight: '700' },
  moneyInput: { flex: 1, fontSize: font.lg, fontWeight: '700', paddingVertical: 0 },

  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: font.xs + 1, fontWeight: '700' },

  notice: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginTop: space.md },
  noticeTitle: { fontSize: font.md, fontWeight: '800', marginBottom: 4 },
  noticeBody: { fontSize: font.sm, lineHeight: 20 },

  outline: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineText: { fontSize: font.md, fontWeight: '800' },
});
