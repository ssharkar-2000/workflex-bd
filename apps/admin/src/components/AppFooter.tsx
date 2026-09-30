import Constants from 'expo-constants';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { BrandName } from './BrandName';
import { useI18n } from '../i18n/I18nContext';
import { buildText, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

/**
 * The system's footer, matching the worker app's: the mark, the tagline, the
 * copyright and the build.
 *
 * It sits at the bottom of the panel's standing surfaces — the dashboard,
 * the lists, the menu and sign-in — without being pinned over them. A fixed
 * strip would cost a line of every screen to repeat what somebody reads
 * once, and would sit on top of the tab bar. So each screen gives its
 * scrolling area `flexGrow: 1` and passes `marginTop: 'auto'` here: a
 * console screen with three rows on it shows the footer along the bottom
 * edge rather than floating halfway up the page, and a full screen closes
 * the scroll with it as before.
 *
 * The version earns its place here more than it does in the worker app. When
 * an admin reports that a screen is wrong, the first question is which build
 * they are on, and the answer should be on the screen rather than in a
 * settings page nobody opens.
 */
export function AppFooter({
  mark = true,
  style,
}: {
  mark?: boolean;
  /** Where a screen passes `marginTop: 'auto'` — see the note above. */
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, text } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const version = Constants.expoConfig?.version;

  return (
    <View style={[s.wrap, style]}>
      {mark ? <BrandName height={18} maxWidth={130} /> : null}

      <Text style={s.tagline}>{t('auth.tagline')}</Text>

      <Text style={s.legal}>
        {t('footer.copyright', { year: new Date().getFullYear() })}
      </Text>

      {version ? (
        <Text style={s.legal}>{t('footer.version', { version })}</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    wrap: {
      marginTop: spacing.xxl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      alignItems: 'center',
      gap: spacing.xs,
    },
    tagline: { ...text.micro, fontWeight: '700', letterSpacing: 0.3, color: colors.textGray },
    legal: { ...text.micro, textAlign: 'center', color: colors.textLight },
  });
}
