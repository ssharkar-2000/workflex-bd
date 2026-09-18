import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../lib/use-theme';
import { radius } from '../lib/theme';

/**
 * A card that responds to being pointed at and pressed.
 *
 * Two states, because this app runs on two kinds of device and they do not
 * share an input model. A pointer can hover, so on the web a card lifts,
 * deepens its shadow and brightens its border as the cursor crosses it. A
 * finger cannot hover — the first thing a touch does is press — so on a phone
 * the same card answers a press by dipping slightly instead.
 *
 * The actions inside stay visible in both states. The reference design reveals
 * "Save" and "View job" on hover, which works on a desktop and hides them
 * permanently on the phone this product is mostly used on: there is no hover
 * to trigger, so the buttons would simply never appear.
 *
 * `useNativeDriver` is not used for the lift because it animates layout-ish
 * properties on web through style, not the animation driver — the transform is
 * applied directly from render state, which react-native-web turns into a CSS
 * transform and the compositor handles for free.
 */
export function InteractiveCard({
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
}) {
  const { c } = useTheme();

  // A card with nowhere to go is not a button, and should not claim to be one
  // or offer feedback for a tap that does nothing.
  if (!onPress) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      /**
       * Deliberately not `accessibilityRole="button"`.
       *
       * The card holds real buttons — Save, View job — and on the web a
       * Pressable with the button role renders an actual `<button>`. Nesting
       * one button inside another is invalid HTML; the browser said so out
       * loud, and the practical cost is that clicks and keyboard focus on the
       * inner controls stop behaving predictably.
       *
       * So the card is a surface that responds to a pointer, not a control. A
       * tap anywhere on it still opens the job, which is a convenience on a
       * phone, while the accessible path to every action remains the labelled
       * button that performs it.
       */
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: hovered ? c.primary : c.border,
        },
        hovered && styles.lifted,
        // Pressing wins over hovering: on a touch screen the two arrive
        // together, and a card that lifts as your finger goes down feels like
        // it is dodging the tap.
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    // Declared here so the hover shadow has something to grow from rather
    // than appearing out of nothing, which reads as a flicker.
    ...Platform.select({
      android: { elevation: 0 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
    ...Platform.select({
      web: { transitionDuration: '160ms', transitionProperty: 'all' },
      default: {},
    }),
  },

  lifted: {
    transform: [{ translateY: -2 }],
    ...Platform.select({
      android: { elevation: 6 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },

  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
});
