import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { BrandName } from './BrandName';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, space } from '../lib/theme';

/**
 * The system's footer: the mark, what the product is, and whose it is.
 *
 * It sits at the bottom of every page, and the two ways of doing that are
 * not equally good. A strip pinned over the content would spend a line of a
 * phone's screen on every page repeating the same three facts, and would
 * collide with the tab bar at the bottom of the app. So instead each page
 * that shows it gives its scrolling area `flexGrow: 1` and passes
 * `marginTop: 'auto'` here: on a short page the footer is pushed to the
 * bottom edge of the screen rather than floating under the content with
 * empty space beneath it, and on a long page it closes the scroll. Either
 * way it is the last thing on the page and never in the way of the work.
 *
 * The year is read from the clock and the version from the app manifest, so
 * neither can rot in the source. Nothing here links to a page that does not
 * exist: this app has no terms or privacy screen yet, so the footer offers
 * support, which is real, and stays quiet about the rest.
 */
export function AppFooter({
  mark = true,
  links = true,
  style,
}: {
  /** Off where the brand is already on the page, like the sign-in screen. */
  mark?: boolean;
  /** Off in the drawer, which lists support as a row of its own. */
  links?: boolean;
  /** Where a page passes `marginTop: 'auto'` — see the note above. */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const version = Constants.expoConfig?.version;

  return (
    <View style={[styles.wrap, { borderTopColor: c.border }, style]}>
      {mark ? <BrandName height={18} maxWidth={130} /> : null}

      <Text style={[styles.tagline, { color: c.textMuted }]}>{t('auth.tagline')}</Text>

      {links ? (
        <Pressable
          onPress={() => router.push('/(app)/support')}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.link, { color: c.primary }]}>{t('support.title')}</Text>
        </Pressable>
      ) : null}

      <Text style={[styles.legal, { color: c.textMuted }]}>
        {t('footer.copyright', { year: new Date().getFullYear() })}
      </Text>

      {version ? (
        <Text style={[styles.legal, { color: c.textMuted }]}>
          {t('footer.version', { version })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: space.xs,
  },
  tagline: { fontSize: font.xs, fontWeight: '700', letterSpacing: 0.3 },
  link: { fontSize: font.xs, fontWeight: '700' },
  legal: { fontSize: font.xs, textAlign: 'center' },
});
