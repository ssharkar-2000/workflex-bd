import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { JOB_CATEGORY_BY_KEY, type NearbyJob } from '@workflex/shared';
import { fetchNearbyJobs } from '../../api/jobs';
import { useDeviceLocation } from '../../lib/use-device-location';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

const HOURS_KEYS: Record<'H2_3' | 'H4_6' | 'H6_8' | 'H8_PLUS', TranslationKey> =
  {
    H2_3: 'jobs.hours.H2_3',
    H4_6: 'jobs.hours.H4_6',
    H6_8: 'jobs.hours.H6_8',
    H8_PLUS: 'jobs.hours.H8_PLUS',
  };

function short(amount: number): string {
  return amount >= 1000 ? `৳${Math.round(amount / 1000)}K` : `৳${amount}`;
}

/**
 * Open work near the viewer, in kilometres.
 *
 * Every distance here is a real great-circle calculation between two real
 * coordinates — but only one of those coordinates is precise, and the card
 * says so rather than letting the reader assume otherwise.
 *
 * A posting's point is the centre of the place it names, resolved from a
 * gazetteer of Bangladeshi neighbourhoods and district towns. That makes a
 * distance accurate to about the size of the place: a few hundred metres
 * inside Dhanmondi, a few kilometres out in a rural district. Every figure is
 * therefore prefixed "~" and rounded to one decimal, and the line under the
 * heading names the point they were measured from — your actual position when
 * you allowed it, the middle of your area when you did not.
 *
 * The alternative was per-posting geocoding, which needs a billed API key and
 * a network call on every job posted. That remains the upgrade path: fill the
 * same two columns more precisely and nothing here changes.
 */
export function NearbyJobs() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { position, status } = useDeviceLocation();

  const { data } = useQuery({
    // The position is part of the key, so moving refetches rather than showing
    // distances measured from where you used to be.
    queryKey: ['nearby-jobs', position?.lat ?? null, position?.lng ?? null],
    queryFn: () => fetchNearbyJobs(position),
    // Held until the permission prompt has been answered either way, so the
    // first request is not fired from the address and then immediately redone
    // from the device.
    enabled: status !== 'asking',
    staleTime: 300_000,
  });

  if (!data) return null;

  // No origin at all: permission refused *and* an address naming nowhere the
  // gazetteer knows. Saying that beats an empty list under a proximity claim.
  if (!data.origin) {
    return (
      <View style={styles.section}>
        <Text style={[styles.title, { color: c.text }]}>
          📍 {t('near.title')}
        </Text>
        <View
          style={[
            styles.empty,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            {t('near.emptyTitle')}
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.emptyCta, { color: c.primary }]}>
              {t('near.setAddress')} →
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const origin = data.origin;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>
          📍 {t('near.title')}
        </Text>
        <Pressable
          onPress={() => {
            // Google Maps centred on wherever the distances were measured
            // from. A pin per job would need the Maps JavaScript API and a
            // billed key; this is the honest version of the same intent.
            const q = position
              ? `${position.lat},${position.lng}`
              : (origin.area ?? '');
            void Linking.openURL(
              `https://maps.google.com/?q=${encodeURIComponent(q)}`,
            ).catch(() => undefined);
          }}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.mapLink, { color: c.primary }]}>
            {t('near.viewMap')} →
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.count, { color: c.textMuted }]}>
        {t('near.count', { count: data.total, radius: data.radiusKm })}
      </Text>

      {/* Which point the kilometres were measured from. A figure taken from a
          GPS fix and one taken from the middle of a neighbourhood deserve
          different amounts of trust, and only the reader can decide that. */}
      <Text style={[styles.origin, { color: c.textMuted }]}>
        {origin.kind === 'DEVICE'
          ? t('near.fromDevice')
          : t('near.fromArea', { area: origin.area ?? '' })}
      </Text>

      <View style={styles.list}>
        {data.jobs.map((row) => (
          <NearbyRow key={row.job.id} row={row} />
        ))}
      </View>

      {data.total > data.jobs.length ? (
        <Pressable
          onPress={() => router.push('/(app)/jobs')}
          accessibilityRole="button"
          style={[styles.seeAll, { borderColor: c.border }]}
        >
          <Text style={[styles.seeAllText, { color: c.primary }]}>
            {t('near.seeAllCount', { count: data.total })} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NearbyRow({ row }: { row: NearbyJob }) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const { job } = row;

  const pay =
    job.salaryMin && job.salaryMax
      ? job.salaryMin === job.salaryMax
        ? short(job.salaryMin)
        : `${short(job.salaryMin)}–${short(job.salaryMax)}`
      : job.salaryMin
        ? `${short(job.salaryMin)}+`
        : job.salaryMax
          ? `${t('post.review.upTo')} ${short(job.salaryMax)}`
          : t('jobs.pay.NEGOTIABLE');

  /**
   * Exactly zero means the job and the viewer resolved to the same place
   * centre — the job is in their own area — and no number can say that
   * honestly. "~0 km" reads as broken and "~100 m" is a distance nobody
   * measured, so the row says the true thing instead.
   *
   * A nonzero sub-kilometre figure is real and reads better in metres, rounded
   * to the nearest hundred so it does not imply precision the origin lacks.
   */
  const distance =
    row.distanceKm === 0
      ? t('near.hereabouts')
      : row.distanceKm < 1
        ? `~${Math.round((row.distanceKm * 1000) / 100) * 100} m`
        : `~${row.distanceKm} km`;

  const facts = [distance, pay, job.hoursBand ? t(HOURS_KEYS[job.hoursBand]) : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/(app)/job/[id]', params: { id: job.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={job.title}
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Text style={styles.emoji}>{JOB_CATEGORY_BY_KEY[job.category].emoji}</Text>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
          {job.title}
        </Text>
        <Text style={[styles.rowFacts, { color: c.textMuted }]} numberOfLines={2}>
          {facts}
        </Text>
        <Text style={[styles.rowPlace, { color: c.textMuted }]} numberOfLines={1}>
          {job.location}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
    </Pressable>
  );
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
  mapLink: { fontSize: font.sm, fontWeight: '800' },

  count: { fontSize: font.sm, fontWeight: '700', marginTop: 4 },
  origin: { fontSize: font.xs, marginTop: 2 },

  list: { marginTop: space.md, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emoji: { fontSize: 22 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: font.sm, fontWeight: '800' },
  rowFacts: { fontSize: font.xs, marginTop: 2, lineHeight: 17, fontWeight: '700' },
  rowPlace: { fontSize: font.xs, marginTop: 1 },
  chevron: { fontSize: font.lg, fontWeight: '700' },

  seeAll: {
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 10,
  },
  seeAllText: { fontSize: font.xs, fontWeight: '800' },

  empty: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  emptyTitle: { fontSize: font.sm, fontWeight: '800' },
  emptyCta: { fontSize: font.sm, fontWeight: '800', marginTop: 8 },
});
