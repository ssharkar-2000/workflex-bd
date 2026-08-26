import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MeshBackground } from '../../src/components/MeshBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { AuroraText } from '../../src/components/AuroraText';
import { RotatingTagline } from '../../src/components/RotatingTagline';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { GlassCard } from '../../src/components/GlassCard';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useAuthStore } from '../../src/store/auth-store';
import { useLaunchStore } from '../../src/store/launch-store';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';

const CHIPS = [
  { icon: '🪪', key: 'auth.chip.nid' },
  { icon: '📍', key: 'auth.chip.nearby' },
  { icon: '💸', key: 'auth.chip.bkash' },
] as const;

/**
 * Pure welcome screen — it says what the product is and offers one way in.
 *
 * The phone field used to live here, which meant asking for a number before
 * the user knew what they were signing up for. Intent now comes first, and
 * the form is two screens later where it has context.
 */
export default function WelcomeScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const openGate = useLaunchStore((s) => s.open);
  const hasSession = useAuthStore((s) => s.status === 'authenticated');

  const hero = useRef(new Animated.Value(0)).current;
  const cta = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const chips = useMemo(() => CHIPS.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(hero, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        80,
        chips.map((v) =>
          Animated.spring(v, {
            toValue: 1,
            friction: 6,
            tension: 70,
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.spring(cta, {
        toValue: 1,
        friction: 9,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hero, cta, float, chips]);

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MeshBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <ThemeToggle tone="light" />
          <LanguageToggle tone="light" />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: hero,
                transform: [
                  {
                    translateY: hero.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    translateY: float.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -12],
                    }),
                  },
                ],
              }}
            >
              <BrandMark size={210} />
            </Animated.View>

            <Text style={[styles.eyebrow, { color: c.accentOnBrand }]}>
              {t('auth.eyebrow')}
            </Text>
            <AuroraText fontSize={42}>WorkFlex BD</AuroraText>
            <RotatingTagline />

            <View style={styles.chips}>
              {CHIPS.map((chip, i) => (
                <Animated.View
                  key={chip.key}
                  style={{
                    opacity: chips[i],
                    transform: [
                      {
                        scale:
                          chips[i]?.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.7, 1],
                          }) ?? 1,
                      },
                    ],
                  }}
                >
                  <GlassCard style={styles.chip} intensity={28}>
                    <Text style={styles.chipIcon}>{chip.icon}</Text>
                    <Text style={[styles.chipText, { color: c.textOnBrand }]}>
                      {t(chip.key)}
                    </Text>
                  </GlassCard>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: cta,
              transform: [
                {
                  translateY: cta.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ShimmerButton
            label={t('auth.getStartedCta')}
            onPress={() =>
              router.push({ pathname: '/(auth)/login', params: { tab: 'register' } })
            }
          />

          <Pressable
            style={styles.signIn}
            onPress={() => {
              // A live session skips straight back in; otherwise this is the
              // shortcut past role selection for a returning user.
              if (hasSession) {
                openGate();
                router.replace('/(app)/home');
              } else {
                router.push('/(auth)/login');
              }
            }}
            hitSlop={8}
          >
            <Text style={[styles.signInText, { color: c.textOnBrand }]}>
              {hasSession ? t('auth.continueSession') : t('auth.haveAccount')}
            </Text>
          </Pressable>

          <View style={styles.secureRow}>
            <Text style={styles.secureIcon}>🔒</Text>
            <Text style={[styles.secureText, { color: c.textMutedOnBrand }]}>
              {t('auth.secure')}
            </Text>
          </View>

          <Pressable
            style={styles.adminLink}
            onPress={() => router.push('/(auth)/admin-login')}
            hitSlop={8}
          >
            <Text style={[styles.adminLinkText, { color: c.textMutedOnBrand }]}>
              {t('adminLogin.entry')}
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },
  hero: { alignItems: 'center', paddingHorizontal: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: '700' },

  footer: { paddingHorizontal: 20, paddingBottom: 10 },
  signIn: { alignItems: 'center', marginTop: 14 },
  signInText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  secureIcon: { fontSize: 11 },
  secureText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  adminLink: { alignItems: 'center', marginTop: 16 },
  adminLinkText: { fontSize: 11, fontWeight: '600', opacity: 0.7 },
});
