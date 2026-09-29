import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

export type QuickAction = {
  label: string;
  /** The action's own colour, so each tile is findable without reading it. */
  tint: string;
  /** A deeper shade of the same, for the mark that carries it. */
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
          {/* A dot rather than the glyph that used to sit in a bubble here.
              The colour is what this row is used by — "the green one" — and
              it survives the icon going; an empty 42pt circle would not. */}
          <View style={[s.dot, { backgroundColor: action.ink }]} />
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
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  label: { fontSize: font.xs, fontWeight: '600', textAlign: 'center' },
});
