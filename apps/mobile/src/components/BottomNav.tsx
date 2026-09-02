import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useT, type TranslationKey } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

/**
 * The five places someone actually goes.
 *
 * Post a job sits in the middle and is drawn as a filled button rather than an
 * icon: it is the one destination that creates something rather than browsing
 * it, and the asymmetry is what makes a five-tab bar readable at a glance
 * instead of a row of five equal glyphs.
 */
const TABS: {
  href: string;
  icon: string;
  label: TranslationKey;
  /** Drawn as the raised centre action. */
  primary?: boolean;
}[] = [
  { href: '/(app)/home', icon: '🏠', label: 'nav.home' },
  { href: '/(app)/jobs', icon: '🔍', label: 'nav.findWork' },
  { href: '/(app)/post-job', icon: '＋', label: 'nav.postJob', primary: true },
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

        if (tab.primary) {
          return (
            <Pressable
              key={tab.href}
              onPress={() => router.push(tab.href as never)}
              accessibilityRole="button"
              accessibilityLabel={t(tab.label)}
              style={styles.tab}
            >
              <View style={[styles.fab, { backgroundColor: c.primary }]}>
                <Text style={[styles.fabIcon, { color: c.primaryText }]}>
                  {tab.icon}
                </Text>
              </View>
              <Text
                style={[styles.label, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {t(tab.label)}
              </Text>
            </Pressable>
          );
        }

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

  fab: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifted so the centre action reads as raised, the way the reference does.
    marginTop: -14,
    ...Platform.select({
      android: { elevation: 4 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
  fabIcon: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
});
