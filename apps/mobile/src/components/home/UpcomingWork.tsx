import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { JobListing } from '@workflex/shared';
import { fetchUpcomingWork } from '../../api/jobs';
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

/** How many shifts the dashboard lists before it stops being a summary. */
const SHOWN = 4;

const WORKING_TIME_KEYS: Record<JobListing['workingTime'], TranslationKey> = {
  MORNING: 'jobs.time.MORNING',
  AFTERNOON: 'jobs.time.AFTERNOON',
  EVENING: 'jobs.time.EVENING',
  NIGHT: 'jobs.time.NIGHT',
  FLEXIBLE: 'jobs.time.FLEXIBLE',
};

const HOURS_KEYS: Record<NonNullable<JobListing['hoursBand']>, TranslationKey> =
  {
    H2_3: 'jobs.hours.H2_3',
    H4_6: 'jobs.hours.H4_6',
    H6_8: 'jobs.hours.H6_8',
    H8_PLUS: 'jobs.hours.H8_PLUS',
  };

function short(amount: number): string {
  return amount >= 1000 ? `৳${Math.round(amount / 1000)}K` : `৳${amount}`;
}

/** Midnight on the given date, for comparing days rather than instants. */
function startOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/**
 * Work this account has agreed to do and has not done yet.
 *
 * The counterpart to the hiring section: a dashboard that shows what you might
 * apply for and what you have applied for, but never what you actually agreed
 * to turn up for, leaves the most time-critical thing on the platform off the
 * screen entirely.
 *
 * Two things the design asked for are not here, because the data does not
 * exist and inventing either would be worse than omitting it:
 *
 * A start and finish time. Nothing in this product records one. A posting says
 * "evening" and "4–6 hours" — which is what employers here actually write —
 * so that is what this shows. Printing "5:00 PM – 7:00 PM" would be a time
 * nobody agreed to, on the one card someone might set an alarm by.
 *
 * A map pin. Jobs carry the free text a recruiter typed, not coordinates, so
 * Navigate hands that text to the phone's map app as a search rather than
 * claiming to know the door.
 */
export function UpcomingWork() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['upcoming-work'],
    queryFn: fetchUpcomingWork,
    staleTime: 120_000,
  });

  if (!data) return null;

  const jobs = data.jobs.slice(0, SHOWN);

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>
          📅 {t('upcoming.title')}
        </Text>
        {data.jobs.length > SHOWN ? (
          <Pressable
            onPress={() => router.push('/(app)/activity')}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={[styles.seeAll, { color: c.primary }]}>
              {t('jobs.seeAll')} →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {jobs.length > 0 ? (
        <View style={styles.list}>
          {jobs.map((job, i) => (
            <ShiftCard
              key={job.id}
              job={job}
              // The day heading is printed once per run of jobs sharing a day,
              // so three shifts on Friday read as one Friday rather than three.
              showDay={i === 0 || dayKey(jobs[i - 1]!) !== dayKey(job)}
            />
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.empty,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            {t('upcoming.emptyTitle')}
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/jobs',
                params: { startWindow: 'TODAY' },
              })
            }
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.emptyCta, { color: c.primary }]}>
              {t('upcoming.findToday')} →
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Groups by calendar day; undated jobs share one bucket of their own. */
function dayKey(job: JobListing): string {
  return job.startDate ? String(startOfDay(new Date(job.startDate))) : 'none';
}

function ShiftCard({ job, showDay }: { job: JobListing; showDay: boolean }) {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const [locale] = useLocale();

  const day = (() => {
    if (!job.startDate) return t('upcoming.noDate');
    const when = new Date(job.startDate);
    const days = Math.round((startOfDay(when) - startOfDay(new Date())) / 86_400_000);
    if (days === 0) return t('upcoming.today');
    if (days === 1) return t('upcoming.tomorrow');
    return when.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  })();

  // What the posting actually says about when: a part of day, and hours per
  // day if the employer gave one. Never a clock range, which nothing records.
  const time = [
    t(WORKING_TIME_KEYS[job.workingTime]),
    job.hoursBand ? t(HOURS_KEYS[job.hoursBand]) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const pay =
    job.salaryMin && job.salaryMax
      ? // A fixed fee is quoted with both bounds equal, and printing it as
        // "৳600–৳600" reads like a range someone forgot to fill in.
        job.salaryMin === job.salaryMax
        ? short(job.salaryMin)
        : `${short(job.salaryMin)}–${short(job.salaryMax)}`
      : job.salaryMin
        ? `${short(job.salaryMin)}+`
        : job.salaryMax
          ? `${t('post.review.upTo')} ${short(job.salaryMax)}`
          : t('jobs.pay.NEGOTIABLE');

  const navigate = () => {
    const query = encodeURIComponent(
      [job.location, job.district].filter(Boolean).join(', '),
    );
    // The cross-platform maps URL: iOS, Android and the web all resolve it,
    // and it searches rather than pretending to a precise pin.
    void Linking.openURL(`https://maps.google.com/?q=${query}`).catch(
      () => undefined,
    );
  };

  return (
    <View>
      {showDay ? (
        <Text style={[styles.day, { color: c.textMuted }]}>{day}</Text>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={[styles.time, { color: c.primary }]}>🕐 {time}</Text>

        <Text style={[styles.jobTitle, { color: c.text }]} numberOfLines={2}>
          {job.title}
        </Text>

        <View style={styles.facts}>
          <Text
            style={[styles.fact, { color: c.textMuted }]}
            numberOfLines={1}
          >
            📍 {job.location}
          </Text>
          <Text style={[styles.fact, { color: c.textMuted }]}>💰 {pay}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/job/[id]',
                params: { id: job.id },
              })
            }
            accessibilityRole="button"
            style={[styles.btn, { borderColor: c.border }]}
          >
            <Text style={[styles.btnText, { color: c.text }]}>
              {t('upcoming.details')}
            </Text>
          </Pressable>
          <Pressable
            onPress={navigate}
            accessibilityRole="button"
            accessibilityLabel={`${t('upcoming.navigate')} — ${job.location}`}
            style={[styles.btn, styles.btnFilled, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.btnText, { color: c.primaryText }]}>
              {t('upcoming.navigate')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
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
  seeAll: { fontSize: font.sm, fontWeight: '800' },

  list: { marginTop: space.md, gap: 10 },
  day: {
    fontSize: font.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 6,
  },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  time: { fontSize: font.xs, fontWeight: '800' },
  jobTitle: { fontSize: font.sm, fontWeight: '800', marginTop: 6 },

  facts: { marginTop: 8, gap: 3 },
  fact: { fontSize: font.xs, lineHeight: 17 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnFilled: { borderColor: 'transparent' },
  btnText: { fontSize: font.xs, fontWeight: '800' },

  empty: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: space.md,
  },
  emptyTitle: { fontSize: font.sm, fontWeight: '800' },
  emptyCta: { fontSize: font.sm, fontWeight: '800', marginTop: 8 },
});
