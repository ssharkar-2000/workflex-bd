import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

export type QuickAction = {
  icon: string;
  label: string;
  onPress: () => void;
};

/**
 * The row of things you can do with the wallet, directly under the balance.
 *
 * Only actions this wallet actually has: money in, money out, and paying
 * someone you hired. The reference design has a fourth tile; inventing one
 * here would mean a button that leads nowhere.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { c } = useTheme();

  return (
    <View style={s.row}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [
            s.action,
            {
              backgroundColor: pressed ? c.primarySoft : c.surface,
              borderColor: c.border,
            },
          ]}
        >
          <View style={[s.bubble, { backgroundColor: c.primarySoft }]}>
            <Text style={[s.icon, { color: c.primary }]}>{action.icon}</Text>
          </View>
          {/* Two lines: "টাকা যোগ করুন" does not fit a third of a phone's
              width, and a truncated label is a guess. */}
          <Text style={[s.label, { color: c.text }]} numberOfLines={2}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bubble: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: font.lg, fontWeight: '700' },
  label: { fontSize: font.xs, fontWeight: '600', textAlign: 'center' },
});
