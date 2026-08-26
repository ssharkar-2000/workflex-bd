import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemePreference } from '../lib/use-theme';
import { radius, font } from '../lib/theme';

const OPTIONS: { value: ThemePreference; icon: string; label: string }[] = [
  { value: 'light', icon: '☀', label: 'Light' },
  { value: 'dark', icon: '☾', label: 'Dark' },
];

/**
 * Light / Dark. The third "Auto" option was removed by request — the device
 * setting now only decides the starting mode, and this is a plain two-way
 * switch after that.
 *
 * `tone="light"` is for the coloured gradient screens, `"dark"` for the
 * normal surfaces — the control has to stay legible on both, and inverting
 * it is cheaper than forcing every screen to one background.
 */
export function ThemeToggle({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const { preference, setPreference, c } = useTheme();
  const onGradient = tone === 'light';

  return (
    <View
      style={[
        styles.wrap,
        onGradient
          ? { backgroundColor: c.glassFill, borderColor: c.glassBorder }
          : { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => void setPreference(option.value)}
            style={[styles.option, active && { backgroundColor: c.primary }]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            hitSlop={4}
          >
            <Text
              style={[
                styles.icon,
                {
                  color: active
                    ? c.primaryText
                    : onGradient
                      ? c.textMutedOnBrand
                      : c.textMuted,
                },
              ]}
            >
              {option.icon}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  option: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  icon: { fontSize: font.sm, fontWeight: '800' },
});
