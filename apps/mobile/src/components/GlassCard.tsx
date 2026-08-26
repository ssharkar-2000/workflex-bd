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

export type GlassTone = 'light' | 'dark';

/**
 * Frosted panel over the mesh background.
 *
 * Android's blur is expensive and, on older hardware, visually unreliable, so
 * it falls back to a layered translucent fill there. The fallback keeps the
 * same border and highlight, so the two platforms read as the same material
 * even though only one is actually sampling what is behind it.
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
  intensity?: number;
  bordered?: boolean;
}) {
  const { c, isDark } = useTheme();

  const fill = {
    backgroundColor: tone === 'dark' ? c.glassStrongFill : c.glassFill,
  };
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
      tint={tone === 'dark' || isDark ? 'dark' : 'light'}
      style={[styles.base, border, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
