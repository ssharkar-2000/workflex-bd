import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MeshBackground } from '../../src/components/MeshBackground';
import { useLaunchStore } from '../../src/store/launch-store';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius } from '../../src/lib/theme';

/**
 * The end of registration.
 *
 * Deliberately its own screen rather than a toast on the dashboard: this is
 * the one moment the applicant learns their documents are in review rather
 * than approved, and a message that disappears after three seconds is the
 * wrong place to say it. The dashboard is one tap away, not blocked.
 */
export default function SuccessScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();

  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop, rise]);

  const goToDashboard = () => {
    // Opens the landing gate so (app) stops redirecting back to welcome.
    useLaunchStore.getState().open();
    router.replace('/(app)/home');
  };

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MeshBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          <View
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Animated.View
              style={[
                styles.markWrap,
                {
                  transform: [
                    {
                      scale: pop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    },
                  ],
                  opacity: pop,
                },
              ]}
            >
              {/* Confetti dots, echoing the reference's scattered specks. */}
              <View
                style={[
                  styles.dot,
                  styles.dotA,
                  { backgroundColor: c.successSoft },
                ]}
              />
              <View
                style={[styles.dot, styles.dotB, { backgroundColor: c.success }]}
              />
              <View
                style={[
                  styles.dot,
                  styles.dotC,
                  { backgroundColor: c.primarySoft },
                ]}
              />

              <View style={[styles.mark, { backgroundColor: c.success }]}>
                <Text style={styles.markIcon}>✓</Text>
              </View>
            </Animated.View>

            <Animated.View
              style={{
                opacity: rise,
                transform: [
                  {
                    translateY: rise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <Text style={[styles.title, { color: c.text }]}>
                {t('ob.success.title')}
              </Text>
              <Text style={[styles.body2, { color: c.textMuted }]}>
                {t('ob.success.body')}
              </Text>

              <View
                style={[
                  styles.note,
                  {
                    backgroundColor: c.warningSoft,
                    borderColor: c.warningBorder,
                  },
                ]}
              >
                <Text style={[styles.noteText, { color: c.warning }]}>
                  {t('ob.success.reviewNote')}
                </Text>
              </View>

              <Pressable
                onPress={goToDashboard}
                style={[styles.cta, { borderColor: c.border }]}
                accessibilityRole="button"
              >
                <Text style={[styles.ctaText, { color: c.text }]}>
                  {t('ob.success.cta')}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 26,
    alignItems: 'center',
  },

  markWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markIcon: { color: '#FFFFFF', fontSize: 42, fontWeight: '800' },

  dot: { position: 'absolute', borderRadius: radius.pill },
  dotA: { width: 14, height: 14, top: 6, left: 10 },
  dotB: { width: 9, height: 9, top: 18, right: 8 },
  dotC: { width: 11, height: 11, bottom: 12, left: 22 },

  title: {
    fontSize: font.xl,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body2: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },

  note: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 18,
  },
  noteText: { fontSize: font.xs, lineHeight: 17, textAlign: 'center' },

  cta: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    alignSelf: 'stretch',
  },
  ctaText: { fontSize: font.md, fontWeight: '700' },
});
