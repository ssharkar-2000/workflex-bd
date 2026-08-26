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
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MeshBackground } from '../MeshBackground';
import { GlassCard } from '../GlassCard';
import { BrandWordmark } from './BrandWordmark';
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
          on `bandBg`, which is a pale blue in both modes — dark icons
          regardless of the theme. */}
      <StatusBar style={showBrand || !isDark ? 'dark' : 'light'} />

      {showBrand ? (
        // Outside the SafeAreaView on purpose: the band has to run under the
        // status bar, so it takes the inset as padding instead of being
        // pushed below it.
        <View
          style={[
            styles.band,
            { backgroundColor: c.bandBg, paddingTop: insets.top + 4 },
          ]}
        >
          {/* Back sits in its own row so the wordmark below stays centred on
              the band rather than on the space left over beside the arrow. */}
          <View style={styles.bandTop}>
            {canGoBack && router.canGoBack() ? (
              <Pressable
                onPress={() => router.back()}
                hitSlop={16}
                style={styles.bandBack}
                accessibilityRole="button"
                accessibilityLabel={t('ob.back')}
              >
                <Text style={[styles.bandBackIcon, { color: c.bandText }]}>
                  ←
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* The system name and nothing else — no logo, no tagline. */}
          <View style={styles.bandBody}>
            <BrandWordmark color={c.bandText} size={font.display} />
          </View>
        </View>
      ) : null}

      {/* The page content is a sheet that laps *up* over the band, rather than
          the band rounding its own bottom corners. Same curve, opposite
          direction — the band stays a full-width rectangle and the sheet's
          corners cut into it, which is what the reference does. */}
      <View
        style={[
          styles.sheet,
          showBrand && {
            marginTop: -radius.xl,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            // On the sheet, not the band: here it follows the curve and reads
            // as the lip of a card. On the band it would cut straight across
            // and the corners would sit on top of it.
            borderTopWidth: 1,
            borderTopColor: c.bandBorder,
            overflow: 'hidden',
          },
        ]}
      >
        {/* Inside the sheet so the rounded corners clip it. */}
        <MeshBackground />

        <SafeAreaView
          style={styles.safe}
          edges={showBrand ? ['bottom'] : ['top', 'bottom']}
        >
          <View style={styles.header}>
            {/* The band carries its own back arrow; two would be one too many. */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  sheet: { flex: 1 },
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
    // A plain full-width rectangle, square to the screen edges. The curve at
    // the bottom belongs to the sheet that laps over it, not to this.
    // Padding covers the sheet's overlap so the visible band keeps its height.
    paddingBottom: 34 + radius.xl,
    paddingHorizontal: 20,
  },
  bandTop: { height: 40, justifyContent: 'center' },
  // Negative margin pulls the 8pt tap padding back out, so the glyph lines up
  // with the band's 20pt gutter instead of sitting 8pt inside it.
  bandBack: { alignSelf: 'flex-start', padding: 8, marginLeft: -8 },
  bandBackIcon: { fontSize: 26, fontWeight: '700', lineHeight: 30 },
  bandBody: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  panel: { borderRadius: 26, padding: 18 },
  footer: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
});
