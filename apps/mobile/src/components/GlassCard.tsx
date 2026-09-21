import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../lib/use-theme';

/**
 * `light` is frosted glass over the mesh background. `dark` is the panel the
 * forms sit on — sign-in, the code check, password reset and every
 * registration step — and despite the name it is no longer glass: see below.
 */
export type GlassTone = 'light' | 'dark';

/**
 * Frosted panel over the mesh background, or the solid form panel.
 *
 * Android's blur is expensive and, on older hardware, visually unreliable, so
 * it falls back to a layered translucent fill there. The fallback keeps the
 * same border and highlight, so the two platforms read as the same material
 * even though only one is actually sampling what is behind it.
 *
 * The form panel used to be the dark tint of that glass, which turned every
 * form a murky grey wherever the mesh behind it was busy. By request it is a
 * solid sheet in the theme's form colour (`formBg`, a pale ice blue in light
 * mode) with its own edge, the same on every platform — no blur to sample,
 * so nothing behind it can muddy it.
 */
export function GlassCard({
  children,
  style,
  tone = 'light',
  intensity = 30,
  bordered = true,
}: {
  children: ReactNode;
  /** Accepts arrays so callers can layer a conditional style on top. */
  style?: StyleProp<ViewStyle>;
  tone?: GlassTone;
  /** How strong the frosting is. The solid form panel ignores it. */
  intensity?: number;
  bordered?: boolean;
}) {
  const { c, isDark } = useTheme();

  if (tone === 'dark') {
    return (
      <View
        style={[
          styles.base,
          { backgroundColor: c.formBg },
          bordered ? { borderWidth: 1.5, borderColor: c.formBorder } : null,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const fill = { backgroundColor: c.glassFill };
  const border = bordered
    ? { borderWidth: 1, borderColor: c.glassBorder }
    : null;

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.base, fill, border, style]}>{children}</View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={[styles.base, border, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
