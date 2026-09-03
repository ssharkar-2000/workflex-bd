import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useT, type TranslationKey } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

/**
 * The four places someone browses to.
 *
 * Posting a job is not among them. It is the one action here that creates
 * something rather than looking at something, and it now lives in a floating
 * button over the content instead of pretending to be a fifth destination —
 * see PostJobFab below.
 */
const TABS: {
  href: string;
  icon: string;
  label: TranslationKey;
}[] = [
  { href: '/(app)/home', icon: '🏠', label: 'nav.home' },
  { href: '/(app)/jobs', icon: '🔍', label: 'nav.findWork' },
  { href: '/(app)/activity', icon: '📊', label: 'nav.activity' },
  { href: '/(app)/profile', icon: '👤', label: 'nav.profile' },
];

/**
 * Screens the bar belongs on.
 *
 * Only the destinations themselves. A drill-down — one job, the CV form, a
 * report — is somewhere you arrived from a tab and return from with Back;
 * offering the tabs again there invites people to leave a half-filled form by
 * a route that discards it.
 */
const TAB_ROUTES = new Set([
  '/home',
  '/jobs',
  '/post-job',
  '/activity',
  '/profile',
]);

/**
 * Where the button sits above the bar.
 *
 * Just the gap, because the button is rendered inside the wrapper that holds
 * the screen — and that wrapper already ends where the bar begins. Adding the
 * bar's height here as well floated it a bar's height too high, marooned in
 * the middle of the content instead of resting above the tabs.
 *
 * Nothing about the safe-area inset either, for the same reason: the bar sits
 * below this wrapper and absorbs the home indicator itself.
 */
const FAB_GAP = 16;

/**
 * The size Material gives a floating action button.
 *
 * Larger than the 42px it was as a docked tab, because it is no longer sitting
 * in a row of equals that set its scale — on its own over the content, 56 is
 * what reads as the primary action rather than as a stray icon.
 */
const FAB_SIZE = 56;

/**
 * Persistent bottom navigation.
 *
 * Laid out as a sibling of the screen rather than floating over it, so no
 * screen needs to know it exists or reserve padding for it. A translucent bar
 * hovering above the content is the usual approach and the usual source of
 * buttons that cannot be reached because something else is under them.
 */
export function BottomNav() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!TAB_ROUTES.has(pathname)) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          // The home indicator on newer phones sits where the labels would be.
          paddingBottom: Math.max(insets.bottom, space.sm),
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href.replace('/(app)', '');

        return (
          <Pressable
            key={tab.href}
            onPress={() => router.push(tab.href as never)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(tab.label)}
            style={styles.tab}
          >
            {/* Emoji render in their own colours, so the active state has to
                be carried by the label and a dot rather than by tinting the
                glyph — which does nothing to a colour emoji. */}
            <Text style={[styles.icon, !active && styles.dim]}>{tab.icon}</Text>
            <Text
              style={[
                styles.label,
                { color: active ? c.primary : c.textMuted },
                active && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {t(tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: space.sm,
    paddingHorizontal: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    // Comfortably past the 44pt minimum touch target, including the label.
    paddingVertical: 2,
  },
  icon: { fontSize: 20, lineHeight: 24 },
  // Emoji cannot be tinted, so an inactive tab is faded instead.
  dim: { opacity: 0.55 },
  label: { fontSize: font.xs - 1, fontWeight: '700' },
  labelActive: { fontWeight: '800' },

  /**
   * Absolutely positioned, which is the whole point: a docked button is part
   * of the bar, while this one sits over the content and stays put as it
   * scrolls beneath.
   */
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: FAB_GAP,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 8 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.24,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  fabIcon: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
});

/**
 * Posting a job, as a button that floats over the content.
 *
 * It was the middle of five tabs, which quietly claimed that creating a
 * posting is a *place* you navigate to alongside Home and Profile. It is not:
 * it is the one thing on this screen that makes something exist, and a
 * floating button is the shape that says so.
 *
 * Deliberately absent on the post-job screen itself. A floating button whose
 * only offer is the screen you are already looking at is furniture.
 *
 * Rendered as an overlay, unlike the bar, which is a sibling — that is what
 * "floating" means and is also the one hazard here, so every scrolling tab
 * screen reserves room for it at the bottom (see `space.fab` in theme.ts).
 */
export function PostJobFab() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  if (!TAB_ROUTES.has(pathname) || pathname === '/post-job') return null;

  return (
    <Pressable
      onPress={() => router.push('/(app)/post-job' as never)}
      accessibilityRole="button"
      accessibilityLabel={t('nav.postJob')}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: c.primary,
          // Pressed state has to come from the button itself: there is no
          // hover on a phone and no ripple on iOS.
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Text style={[styles.fabIcon, { color: c.primaryText }]}>＋</Text>
    </Pressable>
  );
}
