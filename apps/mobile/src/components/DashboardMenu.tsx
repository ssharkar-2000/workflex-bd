import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VerificationLevel } from '@workflex/shared';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

/**
 * The dashboard's account menu.
 *
 * Deliberately settings and account only. Jobs, shifts and the rest live in
 * the tile grid below, and putting them in both places would make neither
 * feel like the real way in. Notifications are likewise absent — the bell is
 * immediately to the left of this button.
 *
 * Rendered in a Modal rather than an absolutely positioned View: the panel
 * has to paint over the ScrollView it is nested in, and on Android a sibling
 * with a higher zIndex still loses to a scroll container's own elevation.
 */
export function DashboardMenu({
  verificationLevel,
  onSignOut,
}: {
  verificationLevel: number;
  onSignOut: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const show = () => {
    setOpen(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // The panel is unmounted in the callback, not alongside it, so the closing
  // animation actually gets to run before the Modal disappears.
  const hide = (then?: () => void) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 130,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
      then?.();
    });
  };

  const go = (path: string) => hide(() => router.push(path as never));

  const verified = verificationLevel >= VerificationLevel.L1_IDENTITY;

  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('menu.open')}
        accessibilityState={{ expanded: open }}
        style={[
          styles.button,
          { backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      >
        {/* Three bars drawn as views rather than a "☰" glyph, which renders
            at wildly different weights across Android system fonts. */}
        <View style={[styles.bar, { backgroundColor: c.text }]} />
        <View style={[styles.bar, { backgroundColor: c.text }]} />
        <View style={[styles.bar, { backgroundColor: c.text }]} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => hide()}
        statusBarTranslucent
      >
        {/* Tapping anywhere off the panel closes it. */}
        <Pressable style={styles.backdrop} onPress={() => hide()}>
          <Animated.View
            style={[
              styles.panelWrap,
              { top: insets.top + 64, opacity: anim },
              {
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Stops a tap inside the panel from reaching the backdrop. */}
            <Pressable
              onPress={() => undefined}
              style={[
                styles.panel,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Item
                icon="👤"
                label={t('menu.profile')}
                onPress={() => go('/(app)/profile')}
              />

              <Item
                icon={verified ? '✅' : '🪪'}
                label={t('menu.verification')}
                hint={
                  verified
                    ? t('menu.verificationDone')
                    : t('menu.verificationTodo')
                }
                onPress={() =>
                  go(verified ? '/(app)/profile' : '/(onboarding)/documents')
                }
              />

              <Item
                icon="💬"
                label={t('menu.support')}
                onPress={() => go('/(app)/support')}
              />

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              <Setting label={t('menu.language')}>
                <LanguageToggle tone="dark" />
              </Setting>

              <Setting label={t('menu.appearance')}>
                <ThemeToggle tone="dark" />
              </Setting>

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              <Item
                icon="↩"
                label={t('home.signOut')}
                danger
                onPress={() => hide(onSignOut)}
              />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

function Item({
  icon,
  label,
  hint,
  danger = false,
  onPress,
}: {
  icon: string;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [
        styles.item,
        pressed && { backgroundColor: c.surfaceAlt },
      ]}
    >
      <Text style={styles.itemIcon}>{icon}</Text>
      <View style={styles.itemText}>
        <Text
          style={[styles.itemLabel, { color: danger ? c.danger : c.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.itemHint, { color: c.textMuted }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {!danger ? (
        <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
      ) : null}
    </Pressable>
  );
}

/** A row that holds a control instead of navigating. */
function Setting({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.setting}>
      <Text style={[styles.settingLabel, { color: c.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: { width: 17, height: 2, borderRadius: 1 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)' },
  panelWrap: { position: 'absolute', right: space.md, left: space.xl },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 6,
    // Lifts the panel off whatever it covers, which is the whole dashboard.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemIcon: { fontSize: 17, width: 22, textAlign: 'center' },
  itemText: { flex: 1 },
  itemLabel: { fontSize: font.md, fontWeight: '600' },
  itemHint: { fontSize: font.xs, marginTop: 1 },
  chevron: { fontSize: 20, fontWeight: '600' },

  divider: { height: 1, marginVertical: 5, marginHorizontal: 14 },

  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  settingLabel: { fontSize: font.sm, fontWeight: '600' },
});
