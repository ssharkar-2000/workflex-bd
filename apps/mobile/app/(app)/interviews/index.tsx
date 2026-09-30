import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { isGoogleMeetUrl, type DayInterview, type WeekDay } from '@workflex/shared';
import { fetchInterviewDay, joinByCode } from '../../../src/api/meet';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { GoogleMeetCard } from '../../../src/components/interviews/GoogleMeetCard';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

const DAY = 86_400_000;

function ymd(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
 * The interview room: one day at a time, with a way in.
 *
 * Both ends of every interview on one screen. Somebody hiring for one job is
 * often applying for another, and splitting their Tuesday across two screens
 * would mean the three o'clock they are hosting and the four o'clock they
 * are attending never appear together.
 *
 * Three things, in the order they are wanted: a way into a meeting somebody
 * has been given the code for, a way to arrange one, and what is on today.
 * The full filtered list is still a tap away — see "All interviews" at the
 * bottom — because this screen answers "what is on now", not "what have I
 * got coming up", and the two questions are asked at different moments.
 */
export default function InterviewRoomScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const [selected, setSelected] = useState(() => ymd(new Date()));
  const [code, setCode] = useState('');

  const day = useQuery({
    queryKey: ['interview-day', selected],
    queryFn: () => fetchInterviewDay(selected),
  });

  const join = useMutation({
    mutationFn: () => joinByCode(code.trim()),
    onSuccess: (interview) => {
      setCode('');
      router.push({ pathname: '/(app)/interviews/all', params: { filter: 'ALL' } });
    },
  });

  const today = ymd(new Date());
  const isToday = selected === today;

  const heading = useMemo(() => {
    const date = new Date(`${selected}T00:00:00`);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, [selected]);

  const shift = (days: number) =>
    setSelected(ymd(new Date(new Date(`${selected}T00:00:00`).getTime() + days * DAY)));

  /**
   * The seven days are worked out here rather than taken from the response.
   *
   * The strip is how somebody moves between days, so it cannot depend on a
   * request that is still in flight — rendering it from `day.data` made the
   * whole control disappear for as long as the next day took to load, which
   * left no way back. Counts still come from the server; they are only dots,
   * and a dot that arrives a moment late costs nothing.
   */
  const week = useMemo<WeekDay[]>(() => {
    const picked = new Date(`${selected}T00:00:00`);
    const monday = new Date(picked.getTime() - ((picked.getDay() + 6) % 7) * DAY);
    const counts = new Map((day.data?.week ?? []).map((w) => [w.date, w.count]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = ymd(new Date(monday.getTime() + i * DAY));
      return { date, count: counts.get(date) ?? 0 };
    });
  }, [selected, day.data]);

  const list = day.data?.interviews ?? [];

  return (
    <MoneyScreen title={t('meet.title')} subtitle={t('meet.subtitle')}>
      {/* The way in, first: somebody opening this screen a minute before
          their interview is holding a code, not looking for a calendar. */}
      <View style={s.joinRow}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder={t('meet.codePlaceholder')}
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.codeInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
        />
        <Pressable
          onPress={() => join.mutate()}
          disabled={code.trim().length < 3 || join.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.joinButton,
            {
              backgroundColor: code.trim().length < 3 ? c.surfaceAlt : c.primary,
              opacity: join.isPending ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              s.joinText,
              { color: code.trim().length < 3 ? c.textMuted : '#FFFFFF' },
            ]}
          >
            {t('meet.join')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/(app)/interviews/schedule')}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.newButton,
          { borderColor: c.primary, backgroundColor: pressed ? c.primarySoft : 'transparent' },
        ]}
      >
        <Text style={[s.newText, { color: c.primary }]}>{t('meet.new')}</Text>
      </Pressable>

      {join.error ? <ErrorBanner message={errorMessage(join.error)} tone="onSurface" /> : null}

      {/* Recruiters connect Google here once; after that every video
          interview they arrange gets a real Meet room. */}
      <GoogleMeetCard />

      {/* The week strip. */}
      <View style={s.strip}>
        <Pressable onPress={() => shift(-7)} hitSlop={10} accessibilityRole="button">
          <Text style={[s.arrow, { color: c.textMuted }]}>‹</Text>
        </Pressable>

        <View style={s.days}>
          {week.map((entry) => (
            <DayCell
              key={entry.date}
              entry={entry}
              selected={entry.date === selected}
              today={entry.date === today}
              onPress={() => setSelected(entry.date)}
            />
          ))}
        </View>

        <Pressable onPress={() => shift(7)} hitSlop={10} accessibilityRole="button">
          <Text style={[s.arrow, { color: c.textMuted }]}>›</Text>
        </Pressable>
      </View>

      <Text style={[s.heading, { color: c.text }]}>{heading}</Text>

      <Notice tone="info" title={t('meet.safeTitle')} body={t('meet.safeBody')} />

      {day.error ? <ErrorBanner message={errorMessage(day.error)} tone="onSurface" /> : null}

      {day.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : list.length === 0 ? (
        <View style={s.empty}>
          <Text style={[s.emptyTitle, { color: c.text }]}>
            {isToday ? t('meet.noneToday') : t('meet.noneThatDay')}
          </Text>
          <Text style={[s.emptyBody, { color: c.textMuted }]}>
            {day.data?.nextUp
              ? t('meet.nextUp', {
                  when: new Date(day.data.nextUp.scheduledAt).toLocaleString(),
                })
              : t('meet.emptyHint')}
          </Text>
        </View>
      ) : (
        list.map((interview) => <MeetingCard key={interview.id} interview={interview} />)
      )}

      <Pressable
        onPress={() => router.push('/(app)/interviews/all')}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.all,
          { borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
        ]}
      >
        <Text style={[s.allText, { color: c.primary }]}>{t('meet.seeAll')}</Text>
      </Pressable>
    </MoneyScreen>
  );
}

function DayCell({
  entry,
  selected,
  today,
  onPress,
}: {
  entry: WeekDay;
  selected: boolean;
  today: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const date = new Date(`${entry.date}T00:00:00`);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
      accessibilityState={{ selected }}
      style={s.dayCell}
    >
      <Text style={[s.dayName, { color: selected ? c.primary : c.textMuted }]}>
        {weekday.slice(0, 3)}
      </Text>
      <View
        style={[
          s.dayNumber,
          selected && { backgroundColor: c.primarySoft },
          today && !selected && { borderWidth: 1, borderColor: c.primary },
        ]}
      >
        <Text
          style={[
            s.dayNumberText,
            { color: selected ? c.primary : c.text, fontWeight: selected ? '900' : '700' },
          ]}
        >
          {date.getDate()}
        </Text>
      </View>
      {/* A dot rather than a count: on a seven-across strip a number would
          have to shrink to fit, and what matters is whether a day has
          anything on it at all. */}
      <View
        style={[
          s.dot,
          { backgroundColor: entry.count > 0 ? c.primary : 'transparent' },
        ]}
      />
    </Pressable>
  );
}

function MeetingCard({ interview }: { interview: DayInterview }) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const start = new Date(interview.scheduledAt);
  const time = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const hosting = interview.side === 'HOSTING';
  const other = hosting ? interview.candidate.name : interview.employer.company ?? interview.employer.name;

  const openRoom = () => {
    if (interview.mode === 'VIDEO' && interview.meetingUrl) {
      void Linking.openURL(interview.meetingUrl).catch(() => {});
      return;
    }
    // No per-interview route exists; the filtered list is where an
    // invitation is accepted, declined or read in full.
    router.push({ pathname: '/(app)/interviews/all', params: { filter: 'ALL' } });
  };

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={s.cardTop}>
        <View style={s.when}>
          <Text style={[s.time, { color: c.text }]}>{time}</Text>
          <Text style={[s.duration, { color: c.textMuted }]}>
            {t('meet.minutes', { n: interview.durationMinutes })}
          </Text>
        </View>

        <View style={s.what}>
          <Text style={[s.jobTitle, { color: c.text }]} numberOfLines={1}>
            {interview.job.title}
          </Text>
          <Text style={[s.who, { color: c.textMuted }]} numberOfLines={1}>
            {hosting ? t('meet.with', { name: other }) : other}
          </Text>
          <Text style={[s.code, { color: c.textMuted }]}>
            {t('meet.code')} {interview.code}
          </Text>
        </View>
      </View>

      <View style={s.cardActions}>
        <View
          style={[
            s.tag,
            { backgroundColor: hosting ? c.primarySoft : c.surfaceAlt },
          ]}
        >
          <Text style={[s.tagText, { color: hosting ? c.primary : c.textMuted }]}>
            {hosting ? t('meet.hosting') : t('meet.attending')}
          </Text>
        </View>

        <Pressable
          onPress={openRoom}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.enter,
            {
              backgroundColor: interview.joinable ? c.primary : 'transparent',
              borderColor: interview.joinable ? c.primary : c.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              s.enterText,
              { color: interview.joinable ? '#FFFFFF' : c.textMuted },
            ]}
          >
            {/* Named for the service it opens, so tapping it into the Google
                Meet app is not a surprise. */}
            {interview.joinable
              ? isGoogleMeetUrl(interview.meetingUrl)
                ? hosting
                  ? t('gmeet.start')
                  : t('gmeet.join')
                : hosting
                  ? t('meet.start')
                  : t('meet.joinNow')
              : t('meet.details')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },

  joinRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: font.sm,
  },
  joinButton: {
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  joinText: { fontSize: font.sm, fontWeight: '800' },

  newButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    marginTop: space.sm,
  },
  newText: { fontSize: font.sm, fontWeight: '800' },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    gap: space.xs,
  },
  arrow: { fontSize: 26, fontWeight: '700', paddingHorizontal: 4 },
  days: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: 3, flex: 1 },
  dayName: { fontSize: font.xs - 2, fontWeight: '800', letterSpacing: 0.3 },
  dayNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: { fontSize: font.sm },
  dot: { width: 5, height: 5, borderRadius: 3 },

  heading: { fontSize: font.md, fontWeight: '900', marginTop: space.md, marginBottom: space.sm },

  empty: { alignItems: 'center', paddingVertical: space.xl * 2 },
  emptyTitle: { fontSize: font.md, fontWeight: '800', textAlign: 'center' },
  emptyBody: {
    fontSize: font.xs + 1,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: space.xs,
  },

  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', gap: space.md },
  when: { minWidth: 62 },
  time: { fontSize: font.md, fontWeight: '900' },
  duration: { fontSize: font.xs - 1, marginTop: 1 },
  what: { flex: 1 },
  jobTitle: { fontSize: font.sm + 1, fontWeight: '800' },
  who: { fontSize: font.xs, marginTop: 2 },
  code: { fontSize: font.xs - 1, marginTop: 3, letterSpacing: 0.4 },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: font.xs - 1, fontWeight: '800' },
  enter: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
  },
  enterText: { fontSize: font.xs, fontWeight: '800' },

  all: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    marginTop: space.md,
  },
  allText: { fontSize: font.xs, fontWeight: '800' },
});
