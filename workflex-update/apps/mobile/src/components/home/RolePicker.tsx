import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { useReduceMotion } from '../../lib/use-reduce-motion';
import { font, radius, space } from '../../lib/theme';
import { ArrowIcon, BriefcaseIcon, HireIcon } from './HomeIcons';

/**
 * The logo's navy — BrandMark's disc — so hiring wears the brand's other
 * colour and the two buttons read as a pair rather than as two of the same.
 */
const NAVY = ['#274F7C', '#162C46'] as const;
/** On a dark page the navy gets the logo's lifted edge, as the logo does. */
const NAVY_EDGE_DARK = 'rgba(143,176,221,0.55)';

const ENTER_MS = 420;
const ENTER_STAGGER_MS = 110;
const GLINT_MS = 1300;
const GLINT_REST_MS = 3200;
/** Band of light that crosses the button, in points. */
const GLINT_WIDTH = 70;
/** Under this a button stacks its icon over its label instead of beside it. */
const STACK_BELOW = 240;

/**
 * The dashboard's two ways in: find work, or hire people.
 *
 * Just the two names, by request — the descriptions and the "you can do both"
 * note came off. Each button carries a drawn icon instead of an emoji, and
 * moves: the pair rises in one after the other, a band of light crosses each
 * in turn — alternating, so the eye goes from one choice to the other rather
 * than seeing both flash at once — and the arrow nudges forward as the light
 * reaches it. All of it holds still when the device asks for less motion.
 */
export function RolePicker() {
  const t = useT();
  const { c, isDark } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: c.text }]}>
        {t('home.roles.title')}
      </Text>
      <View style={styles.row}>
        <RoleButton
          label="home.role.find"
          Icon={BriefcaseIcon}
          href="/(app)/jobs"
          fill={[c.primary, c.primaryPressed]}
          ink={c.primaryText}
          order={0}
        />
        <RoleButton
          label="home.role.hire"
          Icon={HireIcon}
          href="/(app)/post-job"
          fill={NAVY}
          ink="#FFFFFF"
          edge={isDark ? NAVY_EDGE_DARK : undefined}
          order={1}
        />
      </View>
    </View>
  );
}

function RoleButton({
  label,
  Icon,
  href,
  fill,
  ink,
  edge,
  order,
}: {
  label: TranslationKey;
  Icon: ComponentType<{ size: number; color: string }>;
  href: '/(app)/jobs' | '/(app)/post-job';
  fill: readonly [string, string];
  /** Text and icon colour; must be `#RRGGBB`, as it is also used tinted. */
  ink: string;
  edge?: string;
  /** Position in the row, for the stagger and the alternating light. */
  order: number;
}) {
  const t = useT();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);

  const enter = useRef(new Animated.Value(0)).current;
  const glint = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const hover = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      glint.setValue(0);
      return;
    }
    const run = Animated.sequence([
      Animated.delay(order * ENTER_STAGGER_MS),
      Animated.timing(enter, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Half a period apart, so the two take turns.
      Animated.delay((order * (GLINT_MS + GLINT_REST_MS)) / 2),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glint, {
            toValue: 1,
            duration: GLINT_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(GLINT_REST_MS),
        ]),
      ),
    ]);
    run.start();
    return () => run.stop();
  }, [enter, glint, order, reduceMotion]);

  const spring = (value: Animated.Value, toValue: number) =>
    Animated.spring(value, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: toValue ? 0 : 6,
    }).start();

  const stacked = width > 0 && width < STACK_BELOW;
  const span = Math.max(width, 200);

  return (
    <Animated.View
      style={[
        styles.shell,
        { shadowColor: fill[0], opacity: enter },
        {
          transform: [
            {
              translateY: Animated.add(
                enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
                hover.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
              ),
            },
            {
              scale: press.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.96],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => router.push(href)}
        onPressIn={() => spring(press, 1)}
        onPressOut={() => spring(press, 0)}
        onHoverIn={() => spring(hover, 1)}
        onHoverOut={() => spring(hover, 0)}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={t(label)}
        style={[
          styles.button,
          stacked ? styles.buttonStacked : styles.buttonWide,
          edge ? { borderWidth: 1, borderColor: edge } : null,
        ]}
      >
        <LinearGradient
          colors={fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* A soft light from the top corner, and one large faint disc
            behind the arrow: depth without another colour. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.55, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View
          pointerEvents="none"
          style={[styles.disc, { backgroundColor: tint(ink, 0.08) }]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: glint.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-GLINT_WIDTH * 2, span + GLINT_WIDTH],
                  }),
                },
                { rotate: '18deg' },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.32)',
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glint}
          />
        </Animated.View>

        <View
          style={[
            styles.badge,
            stacked && styles.badgeStacked,
            { backgroundColor: tint(ink, 0.16), borderColor: tint(ink, 0.26) },
          ]}
        >
          <Icon size={stacked ? 20 : 22} color={ink} />
        </View>

        <Text
          numberOfLines={2}
          style={[
            styles.label,
            stacked && styles.labelStacked,
            { color: ink },
          ]}
        >
          {t(label)}
        </Text>

        <Animated.View
          style={[
            styles.arrow,
            stacked && styles.arrowStacked,
            {
              backgroundColor: tint(ink, 0.16),
              transform: [
                {
                  translateX: glint.interpolate({
                    inputRange: [0, 0.7, 0.85, 1],
                    outputRange: [0, 0, 5, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ArrowIcon size={16} color={ink} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** `#RRGGBB` at the given opacity. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  title: { fontSize: font.md, fontWeight: '700', marginBottom: space.md },
  row: { flexDirection: 'row', gap: space.md },

  // The shadow sits on the outer shell: the button clips its children for
  // the light to sweep across, and a clipping view hides its own shadow.
  shell: {
    flex: 1,
    borderRadius: radius.lg,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  button: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  buttonWide: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
  },
  // Icon over label; the arrow keeps the top corner.
  buttonStacked: {
    padding: 14,
    gap: 12,
  },

  disc: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    right: -44,
    top: -58,
  },
  glint: { width: GLINT_WIDTH, height: '300%', top: '-100%' },

  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStacked: { width: 40, height: 40 },

  label: {
    flex: 1,
    fontSize: font.lg - 2,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  labelStacked: { flex: 0, fontSize: font.md },

  arrow: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowStacked: {
    position: 'absolute',
    top: 19,
    right: 14,
    width: 30,
    height: 30,
  },
});
