import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MeshBackground } from '../MeshBackground';
import { GlassCard } from '../GlassCard';
import { useT } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius } from '../../lib/theme';

/**
 * Shared frame for every onboarding step: same background, same progress bar,
 * same glass panel. Registration is where users drop off, so each step must
 * feel like one continuous flow rather than a series of unrelated forms.
 */
export function StepShell({
  step,
  total,
  title,
  subtitle,
  children,
  footer,
  canGoBack = true,
  centerHeader = false,
  showBrand = false,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  canGoBack?: boolean;
  /** Centres the title and subtitle, as the registration form does. */
  centerHeader?: boolean;
  /** Brand band across the top, for the screens that open the flow. */
  showBrand?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* The band runs under the status bar, so when it is shown the bar sits
          on `bandBg`, which is a light sky blue in both modes — dark icons
          regardless of the theme. */}
      <StatusBar style={showBrand || !isDark ? 'dark' : 'light'} />
      <MeshBackground />

      {showBrand ? (
        // Outside the SafeAreaView on purpose: the band has to run under the
        // status bar, so it takes the inset as padding instead of being
        // pushed below it.
        <View
          style={[
            styles.band,
            { backgroundColor: c.bandBg, paddingTop: insets.top + 6 },
          ]}
        >
          {canGoBack && router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              // Aligned to the padded content, not to the band's top edge,
              // which runs under the status bar.
              style={[styles.bandBack, { top: insets.top + 6 }]}
            >
              <Text style={[styles.bandBackText, { color: c.bandText }]}>
                ←
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.bandCenter}>
            {/* The pin-and-bolt from the animated mark, held still. The mark
                itself draws its radar in `primary`, which reads as mud on this
                blue — and it would be animating where nobody is looking. */}
            <View style={styles.bandLogo}>
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Path
                  d="M12 1.6c-4 0-7.2 3.1-7.2 7 0 5.1 7.2 14 7.2 14s7.2-8.9 7.2-14c0-3.9-3.2-7-7.2-7z"
                  stroke={c.bandText}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinejoin="round"
                />
                <Path
                  d="M12.9 4.9 9.4 9.6h2.4l-1.1 4 3.6-4.9h-2.5l1.1-3.8z"
                  fill={c.bandText}
                />
              </Svg>
            </View>

            <Text style={[styles.bandName, { color: c.bandText }]}>
              WorkFlex BD
            </Text>
            <Text style={[styles.bandTagline, { color: c.bandText }]}>
              {t('auth.tagline')}
            </Text>
          </View>
        </View>
      ) : null}

      <SafeAreaView
        style={styles.safe}
        edges={showBrand ? ['bottom'] : ['top', 'bottom']}
      >
        <View style={styles.header}>
          {/* The band already carries a back arrow; two would be one too many. */}
          {canGoBack && !showBrand && router.canGoBack() ? (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={[styles.back, { color: c.textOnBrand }]}>
                ← {t('ob.back')}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={[styles.stepLabel, { color: c.accentOnBrand }]}>
            {t('ob.step', { current: step, total })}
          </Text>
        </View>

        <View style={styles.track}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                i < step && { backgroundColor: c.accentOnBrand },
              ]}
            />
          ))}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.title,
                { color: c.textOnBrand },
                centerHeader && styles.centered,
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  { color: c.textMutedOnBrand },
                  centerHeader && styles.centered,
                ]}
              >
                {subtitle}
              </Text>
            ) : null}

            <GlassCard tone="dark" intensity={50} style={styles.panel}>
              {children}
            </GlassCard>
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  back: { fontSize: font.sm, fontWeight: '700' },
  stepLabel: { fontSize: font.xs, fontWeight: '800', letterSpacing: 1.4 },
  track: { flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 20 },
  title: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: font.sm,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  centered: { textAlign: 'center' },

  band: {
    paddingBottom: 18,
    paddingHorizontal: 20,
    // Curved bottom edge, so the page below reads as a sheet lifting over the
    // band rather than two stacked rectangles.
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  bandBack: { position: 'absolute', left: 12, zIndex: 2, padding: 8 },
  bandBackText: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  bandCenter: { alignItems: 'center' },
  bandLogo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    // Lifts the tile off the sky without a third token: the band is light in
    // both modes, so the same white wash works on either.
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  bandName: {
    fontSize: font.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bandTagline: {
    fontSize: font.xs,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
    // Steps the tagline back from the name without a second colour token —
    // both sit on the same fill, so the contrast stays predictable.
    opacity: 0.82,
  },
  panel: { borderRadius: 26, padding: 18 },
  footer: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
});
