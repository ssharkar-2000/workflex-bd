import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AuthUser } from '@workflex/shared';
import { BRAND_NAME_RATIO, BrandName } from '../BrandName';
import { NotificationBell } from '../NotificationBell';
import { DashboardMenu } from '../DashboardMenu';
import { Greeting, ProfileAvatar } from './DashboardSections';
import { HeaderSearch } from './HeaderSearch';
import { useT } from '../../i18n';
import { space } from '../../lib/theme';

/** The wordmark's height wherever there is room for it. */
const BRAND_HEIGHT = 22;
/** Never smaller than this, however narrow the phone. */
const BRAND_HEIGHT_MIN = 12;
/** The search at its smallest: a round button, the size of the bell. */
const SEARCH_MIN = 44;

/**
 * The dashboard's header: one row of controls, then the greeting.
 *
 * Search sits in the row, left of the bell, as a round icon the size of the
 * bell: a 375px phone has about fifty points free there, too narrow for a
 * field anyone could read. Tapped, it flips open into a field that widens
 * over the wordmark and the menu button on a phone — see HeaderSearch. On a
 * wide screen it opens without reaching the wordmark at all.
 *
 * The wordmark gives way a little on the narrowest phones (under about 370
 * points) so the round search button always fits beside it, rather than
 * overlapping it.
 */
export function DashboardHeader({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  const t = useT();
  // The row, and the wordmark's slot within it (between the menu button and
  // the bell). Zero until each has been laid out once.
  const [rowWidth, setRowWidth] = useState(0);
  const [slot, setSlot] = useState({ x: 0, width: 0 });

  const brandHeight = slot.width
    ? Math.max(
        BRAND_HEIGHT_MIN,
        Math.min(
          BRAND_HEIGHT,
          (slot.width - space.sm - SEARCH_MIN) / BRAND_NAME_RATIO,
        ),
      )
    : BRAND_HEIGHT;
  const slotEnd = slot.x + slot.width;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  // Initials beat the last two digits of a phone number as a fallback, but an
  // account that has not registered yet has neither — hence the number.
  const initials = fullName
    ? fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : user.phone.slice(-2);

  return (
    <View style={styles.header}>
      <View
        style={styles.row}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
      >
        <DashboardMenu user={user} onSignOut={onSignOut} />

        <View
          style={styles.slot}
          onLayout={(e) => {
            const { x, width } = e.nativeEvent.layout;
            setSlot({ x, width });
          }}
        >
          <BrandName height={brandHeight} label={t('app.name')} />
        </View>

        <NotificationBell />

        {/* The avatar and the profile-strength ring, merged into one control:
            the ring frames the picture and its figure sits on the ring. */}
        <ProfileAvatar
          hasPhoto={user.hasPhoto}
          initials={initials}
          // Re-fetches when the account's photo state flips, so a selfie
          // taken during verification shows up without a restart.
          version={String(user.hasPhoto)}
          label={t('profile.title')}
        />

        {/* Last, so it is drawn over the wordmark and the menu button when
            it opens across them. */}
        {rowWidth && slot.width ? (
          <HeaderSearch reach={slotEnd} right={rowWidth - slotEnd} />
        ) : null}
      </View>

      <Greeting name={user.firstName ?? user.phone} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center' },
});
