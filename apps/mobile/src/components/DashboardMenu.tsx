import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VerificationLevel, type AuthUser } from '@workflex/shared';
import { Avatar } from './Avatar';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { useT, type TranslationKey } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius, space } from '../lib/theme';

/**
 * The dashboard's account drawer.
 *
 * Two rules decide what is in here.
 *
 * First, it is split by role. An account holds `accountType`, so a job seeker
 * is shown finding work and a company is shown hiring — never both. Listing
 * "Applicants" and "Shortlisted candidates" to someone looking for a shift
 * doubles the drawer's length for nobody's benefit.
 *
 * Second, unbuilt destinations are marked rather than hidden or, worse, left
 * tappable. They read as a roadmap the same way the locked dashboard tiles
 * do, and a row that says "Soon" is honest in a way a row that silently does
 * nothing is not.
 *
 * A full-height drawer rather than the dropdown this replaced: at a dozen-odd
 * rows plus section headings, a panel hanging off the icon covers most of the
 * screen anyway, and does it looking like an accident.
 */

interface Row {
  icon: string;
  label: TranslationKey;
  /** Omitted while the destination does not exist yet. */
  href?: string;
  hint?: TranslationKey;
  danger?: boolean;
}

const WORKER_ROWS: Row[] = [
  { icon: '🔍', label: 'menu.findJobs' },
  { icon: '📄', label: 'menu.myApplications' },
  { icon: '🔖', label: 'menu.savedJobs' },
  { icon: '📅', label: 'menu.myShifts' },
];

const RECRUITER_ROWS: Row[] = [
  { icon: '➕', label: 'menu.postJob' },
  { icon: '📋', label: 'menu.myPostedJobs' },
  { icon: '👥', label: 'menu.applicants' },
  { icon: '🤝', label: 'menu.hiredWorkers' },
];

export function DashboardMenu({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Wide enough to read, narrow enough that the dashboard stays visible
  // behind it — the drawer is a detour, not a new place.
  const drawerWidth = Math.min(320, width * 0.86);

  const show = () => {
    setOpen(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Unmounts in the callback, not alongside it, so the closing slide runs.
  const hide = (then?: () => void) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
      then?.();
    });
  };

  const go = (href: string) => hide(() => router.push(href as never));

  const verified = user.verificationLevel >= VerificationLevel.L1_IDENTITY;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone;

  // COMPANY hires, INDIVIDUAL works. An account that has not finished
  // onboarding has neither yet, and job seeking is the majority case in this
  // market — so that is what an undecided account sees.
  const hiring = user.accountType === 'COMPANY';

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
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdropFill, { opacity: anim }]}>
            <Pressable
              style={styles.backdropPress}
              onPress={() => hide()}
              accessibilityLabel={t('menu.close')}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                backgroundColor: c.surface,
                borderLeftColor: c.border,
                paddingTop: insets.top + 14,
                paddingBottom: insets.bottom + 10,
                transform: [
                  {
                    translateX: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [drawerWidth, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => go('/(app)/profile')}
                style={({ pressed }) => [
                  styles.identity,
                  pressed && { backgroundColor: c.surfaceAlt },
                ]}
                accessibilityRole="button"
              >
                <Avatar
                  hasPhoto={user.hasPhoto}
                  initials={fullName.slice(0, 2).toUpperCase()}
                  size={44}
                  version={String(user.hasPhoto)}
                />
                <View style={styles.identityText}>
                  <Text
                    style={[styles.identityName, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {fullName}
                  </Text>
                  <Text style={[styles.identityHint, { color: c.textMuted }]}>
                    {t('menu.viewEditProfile')}
                  </Text>
                </View>
              </Pressable>

              <Divider />

              <Section title={t(hiring ? 'menu.sec.hiring' : 'menu.sec.work')}>
                {(hiring ? RECRUITER_ROWS : WORKER_ROWS).map((row) => (
                  <MenuRow key={row.label} row={row} onGo={go} />
                ))}
              </Section>

              <Divider />

              <Section title={t('menu.sec.money')}>
                <MenuRow row={{ icon: '👛', label: 'menu.wallet' }} onGo={go} />
              </Section>

              <Divider />

              <Section title={t('menu.sec.standing')}>
                <MenuRow
                  row={{
                    icon: verified ? '✅' : '🛡',
                    label: 'menu.verification',
                    hint: verified
                      ? 'menu.verificationDone'
                      : 'menu.verificationTodo',
                    href: verified
                      ? '/(app)/profile'
                      : '/(onboarding)/documents',
                  }}
                  onGo={go}
                />
                <MenuRow row={{ icon: '⭐', label: 'menu.ratings' }} onGo={go} />
              </Section>

              <Divider />

              <Setting label={t('menu.language')}>
                <LanguageToggle tone="dark" />
              </Setting>
              <Setting label={t('menu.appearance')}>
                <ThemeToggle tone="dark" />
              </Setting>

              <MenuRow
                row={{ icon: '❓', label: 'menu.support', href: '/(app)/support' }}
                onGo={go}
              />

              <Divider />

              <MenuRow
                row={{ icon: '🚪', label: 'home.signOut', danger: true }}
                onGo={go}
                onPress={() => hide(onSignOut)}
              />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function Divider() {
  const { c } = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: c.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function MenuRow({
  row,
  onGo,
  onPress,
}: {
  row: Row;
  onGo: (href: string) => void;
  /** Overrides navigation — used by sign out, which is not a destination. */
  onPress?: () => void;
}) {
  const t = useT();
  const { c } = useTheme();

  const soon = !row.href && !onPress;
  const handle = onPress ?? (row.href ? () => onGo(row.href!) : undefined);

  const body = (
    <>
      <Text style={[styles.rowIcon, soon && styles.dim]}>{row.icon}</Text>
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowLabel,
            { color: row.danger ? c.danger : soon ? c.locked : c.text },
          ]}
          numberOfLines={1}
        >
          {t(row.label)}
        </Text>
        {row.hint ? (
          <Text style={[styles.rowHint, { color: c.textMuted }]} numberOfLines={1}>
            {t(row.hint)}
          </Text>
        ) : null}
      </View>

      {soon ? (
        <View
          style={[
            styles.soon,
            { backgroundColor: c.surfaceAlt, borderColor: c.border },
          ]}
        >
          <Text style={[styles.soonText, { color: c.locked }]}>
            {t('common.comingNext')}
          </Text>
        </View>
      ) : row.danger ? null : (
        <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
      )}
    </>
  );

  // A row with nowhere to go is not a button. Rendering it as a View keeps it
  // out of the tap order instead of offering a press that does nothing.
  if (soon) {
    return (
      <View
        style={styles.row}
        accessibilityLabel={`${t(row.label)}. ${t('common.comingNext')}`}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: c.surfaceAlt },
      ]}
    >
      {body}
    </Pressable>
  );
}

/** A row holding a control instead of navigating. */
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

  overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  backdropPress: { flex: 1 },

  drawer: {
    borderLeftWidth: 1,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: -6, height: 0 },
    elevation: 16,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  identityText: { flex: 1 },
  identityName: { fontSize: font.md, fontWeight: '800' },
  identityHint: { fontSize: font.xs, marginTop: 2 },

  divider: { height: 1, marginVertical: 8, marginHorizontal: 12 },

  sectionTitle: {
    fontSize: font.xs - 1,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingBottom: 4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  rowIcon: { fontSize: 16, width: 21, textAlign: 'center' },
  dim: { opacity: 0.45 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: font.sm + 1, fontWeight: '600' },
  rowHint: { fontSize: font.xs, marginTop: 1 },
  chevron: { fontSize: 19, fontWeight: '600' },

  soon: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  soonText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },

  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  settingLabel: { fontSize: font.sm, fontWeight: '600' },
});
