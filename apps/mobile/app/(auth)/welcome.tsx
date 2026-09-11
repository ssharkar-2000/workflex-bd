import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BrandMark } from '../../src/components/BrandMark';
import { AuroraText } from '../../src/components/AuroraText';
import { ShimmerButton } from '../../src/components/ShimmerButton';
import { GlassCard } from '../../src/components/GlassCard';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { TwoRolesIntro } from '../../src/components/TwoRolesIntro';
import { useAuthStore } from '../../src/store/auth-store';
import { useLaunchStore } from '../../src/store/launch-store';
import { useT } from '../../src/i18n';
import { font, radius } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

// ✓ and ৳ are plain characters, not emoji, so they are drawn in the text
// colour — with none set they would be black on the dark theme's chips.
const CHIPS = [
  { icon: '✓', key: 'auth.chip.nid' },
  { icon: '📍', key: 'auth.chip.nearby' },
  { icon: '৳', key: 'auth.chip.bkash' },
] as const;

/**
 * Whether the intro has played since the app was opened.
 *
 * Kept in the module rather than stored: every cold start lands on this
 * screen (see the root layout), so the intro plays once per launch, and
 * coming back here from sign-in in the same session goes straight to the page
 * instead of replaying ten seconds the reader has just seen.
 */
let introPlayed = false;

/** The brand mark's size: full on most phones, smaller only when it must be. */
const MARK = { max: 210, min: 140 };
/** Vertical padding around the scrolling hero. */
const SCROLL_PAD = 12;

/**
 * Pure welcome screen — it says what the product is and offers the two ways
 * in: Get started for someone new, Log in for someone coming back. Log in is
 * a button of its own under the question it answers, rather than a line of
 * underlined text, so a returning user can find it at a glance.
 *
 * The phone field used to live here, which meant asking for a number before
 * the user knew what they were signing up for. Intent now comes first, and
 * the form is two screens later where it has context.
 *
 * The tagline is one fixed line covering both sides of the market. It used to
 * rotate through three, one per audience, so the product only came across
 * whole to someone who watched all three — and the bKash line on its own made
 * it look like a payments app. bKash is still named, in the chips, as one
 * feature among three rather than as the headline.
 *
 * On a cold start the two-roles intro plays over the top first. The page
 * holds its entrance until the intro hands over, then rises into place under
 * the fading overlay, so the story ends on the page rather than cutting to it.
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

  const [intro, setIntro] = useState<'playing' | 'leaving' | 'done'>(
    introPlayed ? 'done' : 'playing',
  );
  const introFade = useRef(new Animated.Value(1)).current;

  // On a short phone the mark gives up size, so the hero still fits above the
  // two ways in rather than sliding under Get started. It is measured, not
  // guessed from the screen height: Bangla wraps the supporting line onto
  // two, and a larger system text size grows everything except the mark.
  // `rest` is the hero's height without the mark, so the fit is one step.
  const [fit, setFit] = useState({ view: 0, rest: 0 });
  const markSize =
    fit.view && fit.rest
      ? Math.round(Math.min(MARK.max, Math.max(MARK.min, fit.view - fit.rest)))
      : MARK.max;

  const playEntrance = useCallback(() => {
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
  }, [hero, cta, chips]);

  // With no intro to wait for, the page comes in as soon as it mounts. When
  // the intro does play, `endIntro` starts the entrance instead.
  useEffect(() => {
    if (introPlayed) playEntrance();
  }, [playEntrance]);

  useEffect(() => {
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
  }, [float]);

  const endIntro = useCallback(() => {
    introPlayed = true;
    setIntro('leaving');
    playEntrance();
    Animated.timing(introFade, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setIntro('done'));
  }, [introFade, playEntrance]);

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <ThemeToggle tone="light" />
          <LanguageToggle tone="light" />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => {
            const view = e.nativeEvent.layout.height;
            setFit((f) => (Math.abs(f.view - view) < 1 ? f : { ...f, view }));
          }}
        >
          <Animated.View
            onLayout={(e) => {
              const rest = e.nativeEvent.layout.height - markSize + 2 * SCROLL_PAD;
              setFit((f) => (Math.abs(f.rest - rest) < 1 ? f : { ...f, rest }));
            }}
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
              <BrandMark size={markSize} />
            </Animated.View>

            <Text style={[styles.eyebrow, { color: c.accentOnBrand }]}>
              {t('auth.eyebrow')}
            </Text>
            <AuroraText fontSize={42}>WorkFlex BD</AuroraText>
            <Text style={[styles.tagline, { color: c.textOnBrand }]}>
              {t('auth.tagline')}
            </Text>
            <Text
              style={[styles.taglineSupport, { color: c.textMutedOnBrand }]}
            >
              {t('auth.taglineSupport')}
            </Text>

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
                    <Text style={[styles.chipIcon, { color: c.textOnBrand }]}>
                      {chip.icon}
                    </Text>
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

          {/* Someone signed in is not asked; the button just takes them back. */}
          {!hasSession && (
            <Text style={[styles.haveAccount, { color: c.textMutedOnBrand }]}>
              {t('auth.haveAccount')}
            </Text>
          )}
          <Pressable
            onPress={() => {
              // A live session skips straight back in; otherwise this is the
              // shortcut past role selection for a returning user.
              if (hasSession) {
                openGate();
                router.replace('/(app)/home');
              } else {
                router.push({ pathname: '/(auth)/login', params: { tab: 'login' } });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={
              hasSession ? t('auth.continueSession') : t('auth.logIn')
            }
            style={({ pressed }) => [
              styles.logIn,
              hasSession && styles.logInAlone,
              {
                backgroundColor: pressed ? c.primarySoft : c.surface,
                borderColor: c.primary,
              },
            ]}
          >
            <Text style={[styles.logInText, { color: c.primary }]}>
              {`${hasSession ? t('auth.continueSession') : t('auth.logIn')}  →`}
            </Text>
          </Pressable>

          <View style={styles.secureRow}>
            <Text style={styles.secureIcon}>🔒</Text>
            <Text style={[styles.secureText, { color: c.textMutedOnBrand }]}>
              {t('auth.secure')}
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>

      {intro !== 'done' && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: introFade }]}
          pointerEvents={intro === 'leaving' ? 'none' : 'auto'}
        >
          <TwoRolesIntro onEnd={endIntro} />
        </Animated.View>
      )}
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SCROLL_PAD,
  },
  hero: { alignItems: 'center', paddingHorizontal: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 6,
  },
  taglineSupport: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
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
  chipIcon: { fontSize: 13, fontWeight: '800' },
  chipText: { fontSize: 12, fontWeight: '700' },

  footer: { paddingHorizontal: 20, paddingBottom: 10 },
  haveAccount: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
  },
  // Second to Get started: the same width and corners, outlined rather than
  // filled, so the two ways in read as a pair with a clear first choice.
  logIn: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInAlone: { marginTop: 14 },
  logInText: { fontSize: font.md, fontWeight: '800', letterSpacing: 0.2 },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  secureIcon: { fontSize: 11 },
  secureText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
