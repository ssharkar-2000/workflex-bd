import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

export type QuickAction = {
  icon: string;
  label: string;
  /** A light wash behind the icon, so each action is findable by colour. */
  tint: string;
  /** The icon's own colour, dark enough to read on that wash. */
  ink: string;
  onPress: () => void;
};

/**
 * What you can do with the wallet, as a grid.
 *
 * Each action carries its own tint rather than all six sharing the brand
 * colour: this row is used by muscle memory, and colour is what makes "the
 * green one" findable without reading. The washes are pale enough that the
 * labels underneath stay the thing you read.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { c } = useTheme();

  return (
    <View style={s.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [
            s.action,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={[s.bubble, { backgroundColor: action.tint }]}>
            <Text style={[s.icon, { color: action.ink }]}>{action.icon}</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: {
    // Three to a row at any sensible width, with the gap accounted for.
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bubble: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: font.lg, fontWeight: '700' },
  label: { fontSize: font.xs, fontWeight: '600', textAlign: 'center' },
});
