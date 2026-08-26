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
      <MeshBackground />

      {showBrand ? (
        // Outside the SafeAreaView on purpose: the band has to run under the
        // status bar, so it takes the inset as padding instead of being
        // pushed below it.
        <View
          style={[
            styles.band,
            {
              backgroundColor: c.bandBg,
              borderBottomColor: c.bandBorder,
              paddingTop: insets.top + 10,
            },
          ]}
        >
          {/* The system name and nothing else — no logo, no tagline, no back
              control. That one stays on the page below, where it always was. */}
          <BrandWordmark color={c.bandText} />
        </View>
      ) : null}

      <SafeAreaView
        style={styles.safe}
        edges={showBrand ? ['bottom'] : ['top', 'bottom']}
      >
        <View style={styles.header}>
          {canGoBack && router.canGoBack() ? (
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
    paddingBottom: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    // Curved bottom edge, so the page below reads as a sheet lifting over the
    // band rather than two stacked rectangles.
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    // The band is a pale blue and the light-mode page is a pale cream — about
    // 1.2:1 apart. Without this hairline the two just bleed together.
    borderBottomWidth: 1,
  },
  panel: { borderRadius: 26, padding: 18 },
  footer: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
});
