import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '../api/notifications';
import { useT } from '../i18n';
import { useTheme } from '../lib/use-theme';
import { font, radius } from '../lib/theme';

/** Past this the badge says "9+" — three digits do not fit on a bell. */
const BADGE_MAX = 9;

/**
 * The dashboard's way into notifications, with the unread count on it.
 *
 * The count is its own query rather than a slice of the feed: the bell is on
 * screen the whole time the dashboard is, and refetching a fifty-item list on
 * every focus to render one number would be wasteful.
 */
export function NotificationBell() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    // A broadcast is not urgent enough to poll for, but a minute-old count is
    // stale enough to be worth refreshing when the user comes back.
    staleTime: 60_000,
  });

  const label =
    unread > 0
      ? t('notif.bellWithCount', { count: unread })
      : t('notif.bell');

  return (
    <Pressable
      onPress={() => router.push('/(app)/notifications')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      <Text style={styles.icon}>🔔</Text>

      {unread > 0 ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: c.danger, borderColor: c.surface },
          ]}
        >
          <Text style={styles.badgeText} numberOfLines={1}>
            {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
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
  },
  icon: { fontSize: 20 },

  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // White on `danger` in both themes: the badge is a solid fill, and its own
  // colour is what the text has to clear, not the page behind it.
  badgeText: {
    color: '#FFFFFF',
    fontSize: font.xs - 1,
    fontWeight: '800',
    lineHeight: 14,
  },
});
