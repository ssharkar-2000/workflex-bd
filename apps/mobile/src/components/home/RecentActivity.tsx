import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ActivityEvent, ActivityEventKind } from '@workflex/shared';
import { fetchActivityFeed } from '../../api/notifications';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/** How many the dashboard shows before deferring to the full screen. */
const SHOWN = 3;

/**
 * The headline for each kind, and the glyph that carries its tone.
 *
 * Colour is not the signal here — a red dot beside "not selected" would make
 * a routine outcome look like an error, and someone scanning a list of them
 * would read the screen as a list of failures rather than of news.
 */
const KINDS: Record<
  ActivityEventKind,
  { icon: string; title: TranslationKey; body: TranslationKey | null }
> = {
  APPLICATION_VIEWED: {
    icon: '👀',
    title: 'feed.viewed.title',
    body: 'feed.viewed.body',
  },
  APPLICATION_SHORTLISTED: {
    icon: '🟢',
    title: 'feed.shortlisted.title',
    body: 'feed.shortlisted.body',
  },
  APPLICATION_ACCEPTED: {
    icon: '🎉',
    title: 'feed.accepted.title',
    body: 'feed.accepted.body',
  },
  APPLICATION_REJECTED: {
    icon: '📄',
    title: 'feed.rejected.title',
    body: 'feed.rejected.body',
  },
  NEW_APPLICANT: {
    icon: '👤',
    title: 'feed.applicant.title',
    body: 'feed.applicant.body',
  },
  VERIFICATION_APPROVED: {
    icon: '🪪',
    title: 'feed.verified.title',
    body: 'feed.verified.body',
  },
  VERIFICATION_ON_HOLD: {
    icon: '🔍',
    title: 'feed.onHold.title',
    body: 'feed.onHold.body',
  },
  VERIFICATION_REJECTED: {
    icon: '🪪',
    title: 'feed.kycRejected.title',
    body: null,
  },
  ANNOUNCEMENT: { icon: '📢', title: 'feed.announcement.title', body: null },
};

/**
 * What has happened to this account lately.
 *
 * This replaced a list that showed only admin broadcasts, which made the
 * dashboard read like a status page for the platform rather than a record of
 * someone's own week. Announcements are still here — they are occasionally
 * important — but they now sit among the events that are actually about you,
 * in the order things happened.
 *
 * Every row is derived from a database row and carries that row's own
 * timestamp. Nothing is generated on a schedule, and there are no events for
 * things this product does not record: no "you have a new message", because
 * there is no messaging, and no "demand for TypeScript is rising", because
 * only today's demand is knowable and a trend needs a yesterday to compare
 * with.
 */
export function RecentActivity() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: fetchActivityFeed,
    staleTime: 60_000,
  });

  const events = data?.events.slice(0, SHOWN) ?? [];
  if (events.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>
          🔔 {t('feed.title')}
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.viewAll, { color: c.primary }]}>
            {t('dash.viewAll')} →
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {events.map((event, i) => (
          <EventRow
            key={event.id}
            event={event}
            divided={i > 0}
          />
        ))}
      </View>
    </View>
  );
}

function EventRow({
  event,
  divided,
}: {
  event: ActivityEvent;
  divided: boolean;
}) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const spec = KINDS[event.kind];

  // Announcements carry their own words; everything else is a sentence built
  // from the kind so both languages read naturally.
  const body =
    event.kind === 'ANNOUNCEMENT'
      ? event.detail
      : spec.body
        ? t(spec.body, { subject: event.subject ?? '' })
        : event.detail;

  const heading =
    event.kind === 'ANNOUNCEMENT' ? (event.subject ?? t(spec.title)) : t(spec.title);

  return (
    <Pressable
      onPress={() => {
        if (event.href) router.push(event.href as never);
      }}
      disabled={!event.href}
      accessibilityRole={event.href ? 'button' : undefined}
      style={[
        styles.row,
        divided && { borderTopWidth: 1, borderTopColor: c.border },
      ]}
    >
      <Text style={styles.icon}>{spec.icon}</Text>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
          {heading}
        </Text>
        {body ? (
          <Text style={[styles.rowBody, { color: c.textMuted }]} numberOfLines={2}>
            {body}
          </Text>
        ) : null}
        <Text style={[styles.rowAge, { color: c.textMuted }]}>
          {relativeAge(event.at, t)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * "10 min ago", "3 hours ago", "yesterday".
 *
 * Resolved on the device, from the reader's own clock. The server sends an
 * absolute instant precisely so this can be — a phone in another timezone
 * should still read "an hour ago" about the same event.
 */
function relativeAge(iso: string, t: ReturnType<typeof useT>): string {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return t('feed.age.now');

  // Singular and plural are separate keys rather than an "s" appended to the
  // number, because "1 hours ago" is wrong in English and because Bangla does
  // not form plurals that way at all — the two locales need two sentences,
  // not one sentence with a suffix bolted on.
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1
      ? t('feed.age.minute')
      : t('feed.age.minutes', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1
      ? t('feed.age.hour')
      : t('feed.age.hours', { count: hours });
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return t('feed.age.yesterday');
  if (days < 30) return t('feed.age.days', { count: days });
  const months = Math.floor(days / 30);
  return months === 1
    ? t('feed.age.month')
    : t('feed.age.months', { count: months });
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700' },
  viewAll: { fontSize: font.sm, fontWeight: '800' },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    marginTop: space.md,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 10, padding: 14 },
  icon: { fontSize: 18, lineHeight: 22 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: font.sm, fontWeight: '800' },
  rowBody: { fontSize: font.xs, marginTop: 2, lineHeight: 17 },
  rowAge: { fontSize: font.xs, marginTop: 4, fontWeight: '600' },
});
