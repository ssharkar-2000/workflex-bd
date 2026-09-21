import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * The gradient + "glass" badge behind the bolt mark. Replaces the old flat
 * solid-colour circle with a diagonal navy gradient, a soft brand-tinted
 * halo, a glossy top highlight, and a proper drop shadow — the usual recipe
 * for a premium-looking app icon instead of a plain filled shape.
 */
export function BrandMark({ size = 56 }: { size?: number }) {
  const { colors, mode } = useTheme();
  const radius = size * 0.32;
  const haloSize = size + 10;

  return (
    <View
      style={[
        styles.halo,
        {
          width: haloSize,
          height: haloSize,
          borderRadius: radius + 5,
          backgroundColor: colors.brandSoft,
        },
      ]}
    >
      <LinearGradient
        colors={mode === 'dark' ? ['#2C4A70', '#0B1220'] : [colors.primary, '#0E2544']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, { width: size, height: size, borderRadius: radius }]}
      >
        <View style={[styles.sheen, { borderRadius: radius, height: size * 0.55 }]} />
        <Text style={[styles.bolt, { fontSize: size * 0.42 }]}>⚡</Text>
      </LinearGradient>
    </View>
  );
}

/**
 * "WorkFlexBD" as a two-tone wordmark: the capitals that give the name its
 * shape (W, F, BD) pick up the brand colours, the connecting lowercase
 * letters sit in a muted neutral tone — the same trick premium wordmarks
 * (FedEx, eBay, etc.) use to make a compound name read as a single crafted
 * mark instead of plain text.
 */
export function BrandWordmark({ size = 26 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: size, fontWeight: '800', letterSpacing: 0.2 }}>
      <Text style={{ color: colors.primary }}>W</Text>
      <Text style={{ color: colors.textGray, fontWeight: '600' }}>ork</Text>
      <Text style={{ color: colors.brand }}>F</Text>
      <Text style={{ color: colors.textGray, fontWeight: '600' }}>lex</Text>
      <Text style={{ color: colors.textGray, fontWeight: '600' }}> </Text>
      <Text style={{ color: colors.brand }}>BD</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  halo: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bolt: { textAlign: 'center' },
});
