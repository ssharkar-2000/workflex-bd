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
import { type AuthUser } from '@workflex/shared';
import { AppFooter } from './AppFooter';
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
  label: TranslationKey;
  /** Omitted while the destination does not exist yet. */
  href?: string;
  hint?: TranslationKey;
  danger?: boolean;
}

const WORKER_ROWS: Row[] = [
  /**
   * A posting tool, in the section it was asked to sit in. Both sections show
   * for every account — see the note beside them — so an employer finds it
   * here whichever half of the drawer they were reading.
   */
  {
    label: 'menu.jobAssistant',
    hint: 'menu.jobAssistantHint',
    href: '/(app)/job-assistant',
  },
  /**
   * Second in Find work, above the "my ..." rows, because it answers a
   * question that comes before them: where to look, and what to learn. The
   * rows below it are for tracking work already found.
   */
  { label: 'menu.workMap', hint: 'menu.workMapHint', href: '/(app)/work-map' },
  { label: 'menu.myApplications', href: '/(app)/activity' },
  // Where an application ends up once it is accepted: the job, and the
  // recruiter to rate and review.
  { label: 'menu.myRecruiters', href: '/(app)/my-recruiters' },
  // Same screen, opened with its Saved filter already on — see the `saved`
  // parameter in app/(app)/jobs.tsx.
  { label: 'menu.savedJobs', href: '/(app)/jobs?saved=1' },
  { label: 'menu.myShifts', href: '/(app)/shifts' },
  /**
   * Above the volunteer row, below the paid rows: an internship is paid work
   * somebody is looking for, and a fresh graduate reading this section is
   * looking for exactly that. Both boards reach past our own listings, so
   * they sit together at the end of Find work.
   */
  { label: 'menu.internships', hint: 'menu.internshipsHint', href: '/(app)/internships' },
  /**
   * Under Find work, below the paid rows: volunteering is work somebody
   * looks for in the same frame of mind, and it belongs where they are
   * already looking rather than in a section of its own.
   */
  { label: 'menu.volunteer', hint: 'menu.volunteerHint', href: '/(app)/volunteering' },
  /** Conversations about a job, from either side — see app/(app)/messages. */
  { label: 'menu.messages', href: '/(app)/messages' },
  /** Interviews and other scheduled calls, with the link to join — see app/(app)/meetings. */
  { label: 'menu.meetings', href: '/(app)/meetings' },
];

const RECRUITER_ROWS: Row[] = [
  /**
   * The row asked for in this section. The button itself is on every job's
   * own screen, beside Apply — an application needs a job to be an
   * application — so this opens the list to pick one from.
   */
  { label: 'menu.oneClick', hint: 'menu.oneClickHint', href: '/(app)/jobs' },
  { label: 'menu.myPostedJobs', href: '/(app)/activity?tab=jobs' },
  // Applicants belong to a posting, so this opens the postings, each of
  // which opens its own applicants.
  { label: 'menu.applicants', href: '/(app)/activity?tab=jobs' },
  { label: 'menu.interviews', href: '/(app)/interviews' },
  // Where an interview is held as a video call: schedule it, invite the
  // candidate, and both sit in the same room.
  { label: 'menu.meetings', href: '/(app)/meetings' },
  { label: 'menu.hiredWorkers', href: '/(app)/hired' },
  /**
   * Last in Hire people, because it is the row somebody opens when something
   * has gone wrong rather than while they are hiring. Being in this section
   * at all matters: a cancellation at nine at night is not a thing to go
   * hunting through a menu for.
   */
  { label: 'menu.cover', hint: 'menu.coverHint', href: '/(app)/cover' },
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

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone;


  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('menu.open')}
        accessibilityState={{ expanded: open }}
        // Hover matches the search and the bell it sits beside.
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.button,
          {
            backgroundColor: c.surfaceAlt,
            borderColor: hovered ? c.primary : c.border,
          },
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
                borderRightColor: c.border,
                paddingTop: insets.top + 14,
                paddingBottom: insets.bottom + 10,
                transform: [
                  {
                    // Negative, so it starts off the *left* edge and slides
                    // in towards the middle. Positive would park it off the
                    // right and slide the wrong way across the screen.
                    translateX: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-drawerWidth, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.drawerScroll}
            >
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

              {/* Both sections, always. The drawer used to show one or the
                  other based on an account type chosen at signup; there is no
                  such choice now, and the same person may look for a shift in
                  the morning and hire a cleaner in the afternoon. */}
              <Section title={t('menu.sec.work')}>
                {WORKER_ROWS.map((row) => (
                  <MenuRow key={row.label} row={row} onGo={go} />
                ))}
              </Section>

              <Divider />

              <Section title={t('menu.sec.hiring')}>
                {RECRUITER_ROWS.map((row) => (
                  <MenuRow key={row.label} row={row} onGo={go} />
                ))}
              </Section>

              <Divider />

              <Section title={t('menu.sec.money')}>
                <MenuRow
                  row={{ label: 'menu.wallet', href: '/(app)/wallet' }}
                  onGo={go}
                />
                <MenuRow
                  row={{
                    label: 'menu.plans',
                    hint: 'menu.plansHint',
                    href: '/(app)/subscription',
                  }}
                  onGo={go}
                />
              </Section>

              <Divider />

              {/* Verification is not listed here any more: it lives in My
                  Profile, under the trust score it feeds, reached from the
                  identity row at the top of this drawer. */}
              <Section title={t('menu.sec.standing')}>
                {/*
                  First in "Your standing", above the CV. A CV is what
                  somebody says about themselves; these are the parts a
                  university or a former employer has signed for. The
                  stronger claim goes first.
                */}
                <MenuRow
                  row={{
                    label: 'menu.chain',
                    hint: 'menu.chainHint',
                    href: '/(app)/trustchain',
                  }}
                  onGo={go}
                />
                <MenuRow
                  row={{
                    label: 'menu.cv',
                    hint: 'menu.cvHint',
                    href: '/(app)/cv',
                  }}
                  onGo={go}
                />
                <MenuRow
                  row={{
                    label: 'menu.resumeBuilder',
                    hint: 'menu.resumeBuilderHint',
                    href: '/(app)/resume',
                  }}
                  onGo={go}
                />
                {/*
                  Directly above the Learning Lab, because that is where it
                  sends people. The radar says which skill is worth a
                  fortnight; the lab is where the fortnight is spent.
                */}
                <MenuRow
                  row={{
                    label: 'menu.radar',
                    hint: 'menu.radarHint',
                    href: '/(app)/skill-radar',
                  }}
                  onGo={go}
                />
                {/*
                  Between the radar and the lab, which is the order somebody
                  actually moves through: the radar says what is in demand,
                  a mock test says where they stand on it, and the lab is
                  where the gap gets closed.
                */}
                <MenuRow
                  row={{
                    label: 'menu.mock',
                    hint: 'menu.mockHint',
                    href: '/(app)/mock',
                  }}
                  onGo={go}
                />
                <MenuRow
                  row={{
                    label: 'menu.learningLab',
                    hint: 'menu.learningLabHint',
                    href: '/(app)/learning',
                  }}
                  onGo={go}
                />
                {/*
                  Beside ratings, because both answer the same question from
                  an employer's side: what has this person actually done.
                */}
                <MenuRow
                  row={{
                    label: 'menu.achievements',
                    hint: 'menu.achievementsHint',
                    href: '/(app)/achievements',
                  }}
                  onGo={go}
                />
                <MenuRow
                  row={{
                    label: 'menu.ratings',
                    hint: 'menu.ratingsHint',
                    href: '/(app)/ratings',
                  }}
                  onGo={go}
                />
              </Section>

              <Divider />

              <Setting label={t('menu.language')}>
                <LanguageToggle tone="dark" />
              </Setting>
              <Setting label={t('menu.appearance')}>
                <ThemeToggle tone="dark" />
              </Setting>

              <MenuRow
                row={{ label: 'menu.support', href: '/(app)/support' }}
                onGo={go}
              />
              <MenuRow
                row={{
                  label: 'menu.report',
                  hint: 'menu.reportHint',
                  href: '/(app)/report',
                }}
                onGo={go}
              />

              <Divider />

              <MenuRow
                row={{ label: 'home.signOut', danger: true }}
                onGo={go}
                onPress={() => hide(onSignOut)}
              />

              <AppFooter links={false} style={styles.pushDown} />
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
  // flexGrow lets the drawer body fill its height, which is what gives
  // pushDown something to push against on a short menu.
  drawerScroll: { flexGrow: 1 },
  /** Sends the footer to the bottom of the drawer rather than under the rows. */
  pushDown: { marginTop: 'auto' },
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

  /**
   * The drawer sits against the left edge, under the button that opens it.
   *
   * It used to be `flex-end`, which put the panel on the right while the
   * hamburger stayed on the left — so the thing you tapped and the thing that
   * appeared were at opposite ends of the screen, and the panel looked like it
   * had come from somewhere else entirely.
   */
  overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-start' },
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
    // The open edge is now the right-hand one, so that is where the hairline
    // and the shadow belong — both were on the left, which is the edge that
    // is flush against the screen and shows neither.
    borderRightWidth: 1,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
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
