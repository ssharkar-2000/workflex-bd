import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatTaka, type Calendar, type CalendarEvent } from '@workflex/shared';
import { fetchCalendar } from '../../api/calendar';
import { ErrorBanner } from '../ErrorBanner';
import { countStates, eventState, type EventState } from '../../lib/calendar-state';
import { useErrorMessage } from '../../lib/error-message';
import { useT, type TranslationKey } from '../../i18n';
import { useTheme } from '../../lib/use-theme';
import { font, radius, space } from '../../lib/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * A colour per state, used everywhere a state is shown.
 *
 * Deliberately not a colour per kind, which is what these marks used to
 * carry. Shift-or-interview is already written in words on every row and
 * marked S or I in every cell; whether a day holds something still to come
 * or something already missed was nowhere, and it is the thing a person
 * opens a calendar to find out.
 */
function stateTone(state: EventState, c: { primary: string; danger: string; textMuted: string }) {
  if (state === 'MISSED') return c.danger;
  if (state === 'UPCOMING') return c.primary;
  return c.textMuted;
}

/**
 * A month of work at a glance, and a list of what is coming.
 *
 * Both views read the same events: shifts and interviews, from both sides of
 * the platform. The grid answers "how busy is next week"; the list under it
 * answers "what is next, and where do I have to be". Neither is complete
 * without the other, so this carries both rather than making the person
 * choose a mode and lose half the answer.
 *
 * Every marker carries a letter as well as a colour — S for a shift, I for
 * an interview — because a calendar that means anything only in colour
 * means nothing to a person who cannot tell those colours apart.
 *
 * It is a component rather than a screen because the month belongs on My
 * Shifts, above the list, not behind a button somebody has to know to press.
 * A fragment, not a page: whichever screen it sits in owns the scrolling,
 * the title and the pull-to-refresh.
 */
export function ShiftCalendar() {
  const t = useT();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(todayKey());
  const [open, setOpen] = useState<CalendarEvent | null>(null);

  // A month either side of the one on screen, so paging back and forth does
  // not refetch on every tap.
  const from = new Date(month);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(month);
  to.setMonth(to.getMonth() + 2);

  const calendar = useQuery<Calendar>({
    queryKey: ['calendar', monthKey(month)],
    queryFn: () => fetchCalendar(from.toISOString(), to.toISOString()),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of calendar.data?.events ?? []) {
      const key = event.startsAt.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [calendar.data]);

  const cells = useMemo(() => monthGrid(month), [month]);
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];
  const selectedCounts = countStates(selectedEvents);

  /**
   * A tapped day opens what is on it.
   *
   * With one task on that date it goes straight to its details: the tap has
   * already said which task, and making somebody tap the date, then the row,
   * then a button is three taps to reach the thing they pointed at. With
   * several, the day's list below is the answer — the tap is ambiguous and
   * guessing which one they meant would be worse than showing all of them.
   */
  const openDay = (key: string) => {
    setSelected(key);
    const onThatDay = byDay.get(key) ?? [];
    const only = onThatDay[0];
    if (onThatDay.length === 1 && only) setOpen(only);
  };

  // What is coming, from today, whatever month the grid is showing.
  const upcoming = (calendar.data?.events ?? [])
    .filter((event) => event.startsAt >= new Date().toISOString())
    .slice(0, 12);

  return (
    <>
      {/* Month, and the way through the year */}
      <View style={s.monthRow}>
        <Pressable
          onPress={() => setMonth(addMonths(month, -1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.previousMonth')}
          hitSlop={10}
        >
          <Text style={[s.arrow, { color: c.primary }]}>◀</Text>
        </Pressable>
        <Text style={[s.month, { color: c.text }]}>
          {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          onPress={() => setMonth(addMonths(month, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}
          hitSlop={10}
        >
          <Text style={[s.arrow, { color: c.primary }]}>▶</Text>
        </Pressable>
      </View>

      {calendar.error ? (
        <ErrorBanner message={errorMessage(calendar.error)} tone="onSurface" />
      ) : null}

      <View style={[s.grid, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={s.weekRow}>
          {WEEKDAYS.map((day) => (
            <Text key={day} style={[s.weekday, { color: c.textMuted }]}>
              {day}
            </Text>
          ))}
        </View>

        {chunk(cells, 7).map((week, i) => (
          <View key={i} style={s.weekRow}>
            {week.map((cell, j) => {
              const key = cell ? dayKey(cell) : `blank-${i}-${j}`;
              const events = cell ? (byDay.get(dayKey(cell)) ?? []) : [];
              const isToday = cell ? dayKey(cell) === todayKey() : false;
              const isSelected = cell ? dayKey(cell) === selected : false;

              return (
                <Pressable
                  key={key}
                  disabled={!cell}
                  onPress={() => cell && openDay(dayKey(cell))}
                  accessibilityRole={cell ? 'button' : undefined}
                  accessibilityLabel={
                    cell
                      ? [
                          `${cell.getDate()} ${month.toLocaleDateString('en-GB', { month: 'long' })}`,
                          `${events.length} ${t('calendar.events')}`,
                          // The count that matters is spoken, not just drawn:
                          // a screen reader gets no help from a red letter.
                          countStates(events).MISSED > 0
                            ? t('calendar.count.missed', { count: countStates(events).MISSED })
                            : '',
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : undefined
                  }
                  style={[
                    s.cell,
                    isSelected && { backgroundColor: c.primarySoft, borderColor: c.primary },
                  ]}
                >
                  {cell ? (
                    <>
                      <Text
                        style={[
                          s.cellDate,
                          { color: isToday ? c.primaryText : c.text },
                          isToday && { backgroundColor: c.primary },
                        ]}
                      >
                        {cell.getDate()}
                      </Text>
                      <View style={s.dots}>
                        {/* The letter says which kind it is, the colour says
                            whether it is still coming or was missed. */}
                        {events.slice(0, 3).map((event) => (
                          <Text
                            key={event.id}
                            style={[s.dot, { color: stateTone(eventState(event), c) }]}
                          >
                            {event.kind === 'SHIFT' ? 'S' : 'I'}
                          </Text>
                        ))}
                        {events.length > 3 ? (
                          <Text style={[s.dot, { color: c.textMuted }]}>
                            +{events.length - 3}
                          </Text>
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* What the colours in the grid mean. */}
      <View style={s.legend}>
        {(['UPCOMING', 'MISSED', 'DONE'] as EventState[]).map((state) => (
          <View key={state} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: stateTone(state, c) }]} />
            <Text style={[s.legendText, { color: c.textMuted }]}>
              {t(state === 'DONE' ? 'calendar.legend.past' : `calendar.state.${state}`)}
            </Text>
          </View>
        ))}
      </View>

      {/* The chosen day */}
      {selected ? (
        <>
          <Text style={[s.section, { color: c.text }]}>
            {new Date(selected).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>

          {selectedEvents.length > 0 ? (
            <Text style={[s.dayCounts, { color: c.textMuted }]}>
              {[
                selectedCounts.UPCOMING > 0
                  ? t('calendar.count.upcoming', { count: selectedCounts.UPCOMING })
                  : '',
                selectedCounts.MISSED > 0
                  ? t('calendar.count.missed', { count: selectedCounts.MISSED })
                  : '',
                selectedCounts.DONE + selectedCounts.CANCELLED > 0
                  ? t('calendar.count.past', {
                      count: selectedCounts.DONE + selectedCounts.CANCELLED,
                    })
                  : '',
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
          ) : null}

          {selectedEvents.length === 0 ? (
            <Text style={[s.empty, { color: c.textMuted }]}>{t('calendar.nothingOn')}</Text>
          ) : (
            selectedEvents.map((event) => (
              <Row key={event.id} event={event} onOpen={() => setOpen(event)} />
            ))
          )}
        </>
      ) : null}

      {/* What is coming */}
      <Text style={[s.section, { color: c.text }]}>{t('calendar.timeline')}</Text>
      {calendar.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : upcoming.length === 0 ? (
        <Text style={[s.empty, { color: c.textMuted }]}>{t('calendar.nothingAhead')}</Text>
      ) : (
        upcoming.map((event) => (
          <Row key={`up-${event.id}`} event={event} showDate onOpen={() => setOpen(event)} />
        ))
      )}

      <EventDetails event={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Row({
  event,
  showDate,
  onOpen,
}: {
  event: CalendarEvent;
  showDate?: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const at = new Date(event.startsAt);
  const state = eventState(event);
  const tone = stateTone(state, c);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: pressed ? c.surfaceAlt : c.surface,
          borderColor: c.border,
        },
      ]}
    >
      <View style={s.rowTime}>
        <Text style={[s.rowClock, { color: c.text }]}>
          {at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </Text>
        {showDate ? (
          <Text style={[s.rowDate, { color: c.textMuted }]}>
            {at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </Text>
        ) : null}
      </View>

      <View style={s.rowBody}>
        <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[s.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
          {t(`calendar.kind.${event.kind}` as TranslationKey)}
          {' · '}
          {t(`calendar.role.${event.role}` as TranslationKey)}
          {event.counterpart.name ? ` · ${event.counterpart.company ?? event.counterpart.name}` : ''}
        </Text>
      </View>

      {/* The kind is already the first word of the line above, so this says
          the thing that line cannot: whether it still needs doing. */}
      <Text style={[s.rowState, { color: tone, borderColor: tone }]} numberOfLines={1}>
        {t(`calendar.state.${state}` as TranslationKey)}
      </Text>
    </Pressable>
  );
}

/** Everything about one event: the job, the person, and the identifiers. */
function EventDetails({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  if (!event) return null;

  const starts = new Date(event.startsAt);
  const ends = new Date(event.endsAt);
  const state = eventState(event);
  const tone = stateTone(state, c);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          {/* Coloured by state, so a missed task is red at the top of the
              sheet rather than only in a row halfway down it. */}
          <Text style={[s.sheetKind, { color: tone }]}>
            {t(`calendar.state.${state}` as TranslationKey)} ·{' '}
            {t(`calendar.kind.${event.kind}` as TranslationKey)} ·{' '}
            {t(`calendar.role.${event.role}` as TranslationKey)}
          </Text>
          <Text style={[s.sheetTitle, { color: c.text }]}>{event.title}</Text>

          <View style={[s.sheetRows, { borderTopColor: c.border }]}>
            <Detail
              label={t('calendar.when')}
              value={`${starts.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${starts.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${ends.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
            />
            <Detail
              label={t('calendar.withWhom')}
              value={event.counterpart.company ?? event.counterpart.name ?? '—'}
            />
            {event.counterpart.publicId ? (
              <Detail label={t('calendar.theirId')} value={event.counterpart.publicId} mono />
            ) : null}
            {event.counterpart.phone ? (
              <Detail label={t('calendar.phone')} value={event.counterpart.phone} />
            ) : null}
            <Detail label={t('calendar.jobId')} value={event.job.id} mono />
            {event.location ? (
              <Detail label={t('calendar.where')} value={event.location} />
            ) : null}
            {event.mode ? (
              <Detail
                label={t('calendar.how')}
                value={t(`interviews.mode.${event.mode}` as TranslationKey)}
              />
            ) : null}
            {event.pay !== null ? (
              <Detail label={t('calendar.pay')} value={formatTaka(event.pay)} />
            ) : null}
            <Detail
              label={t('calendar.status')}
              value={t(`calendar.state.${state}` as TranslationKey)}
            />
          </View>

          {event.notes ? (
            <Text style={[s.sheetNotes, { color: c.textMuted }]}>{event.notes}</Text>
          ) : null}

          <View style={s.sheetActions}>
            {event.meetingUrl ? (
              <Pressable
                onPress={() => void Linking.openURL(event.meetingUrl!).catch(() => {})}
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.primary,
                  { backgroundColor: pressed ? c.primaryPressed : c.primary },
                ]}
              >
                <Text style={[s.primaryText, { color: c.primaryText }]}>
                  {t('interviews.join')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                onClose();
                if (event.kind === 'SHIFT') {
                  router.push({ pathname: '/(app)/shifts/[id]', params: { id: event.id } });
                  return;
                }
                // Interviews have no screen of their own, so this opens the
                // list already showing the side and the filter that contain
                // this one, with the card itself marked and moved to the top.
                // Missed goes to All: a past interview nobody marked matches
                // none of the other filters, and landing on a list without it
                // would be worse than no link at all.
                router.push({
                  pathname: '/(app)/interviews',
                  params: {
                    focus: event.id,
                    side: event.role === 'EMPLOYER' ? 'HOSTING' : 'ATTENDING',
                    filter:
                      state === 'MISSED'
                        ? 'ALL'
                        : state === 'DONE'
                          ? 'COMPLETED'
                          : state === 'CANCELLED'
                            ? 'CANCELLED'
                            : isToday(starts)
                              ? 'TODAY'
                              : 'UPCOMING',
                  },
                });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.secondary,
                {
                  borderColor: c.primarySoftBorder,
                  backgroundColor: pressed ? c.primarySoft : 'transparent',
                },
              ]}
            >
              <Text style={[s.secondaryText, { color: c.primary }]}>
                {t('calendar.openIt')}
              </Text>
            </Pressable>

            <Pressable onPress={onClose} accessibilityRole="button" style={s.close}>
              <Text style={[s.closeText, { color: c.textMuted }]}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={s.detail}>
      <Text style={[s.detailLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.detailValue, { color: c.text }, mono && s.mono]}
        numberOfLines={mono ? 1 : 3}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// --- dates -----------------------------------------------------------------

/**
 * "2026-09" for the month on screen, in local time.
 *
 * Not toISOString(): the first of the month at local midnight is still the
 * previous month in UTC anywhere east of Greenwich, so that would key Dhaka's
 * September under August and fetch the wrong window.
 */
function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayKey(): string {
  return dayKey(new Date());
}

function isToday(date: Date): boolean {
  return dayKey(date) === todayKey();
}

/** The month as a grid of weeks starting Monday, padded with blanks. */
function monthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  // getDay() counts from Sunday; this calendar starts on Monday.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const s = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    paddingHorizontal: space.sm,
  },
  arrow: { fontSize: font.md, fontWeight: '800' },
  month: { fontSize: font.lg, fontWeight: '800' },

  grid: { borderWidth: 1, borderRadius: radius.lg, padding: space.sm, marginTop: space.md },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, fontSize: 11, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
  cell: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    paddingTop: 4,
    gap: 2,
  },
  cellDate: {
    fontSize: font.xs,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingVertical: 1,
  },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { fontSize: 9, fontWeight: '800' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: space.sm,
    paddingHorizontal: space.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  legendText: { fontSize: font.xs },

  dayCounts: { fontSize: font.xs, marginTop: -space.xs, marginBottom: space.sm },

  section: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.sm },
  empty: { fontSize: font.sm, lineHeight: 20 },
  loading: { marginTop: space.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.sm,
    marginBottom: space.sm,
  },
  rowTime: { width: 52 },
  rowClock: { fontSize: font.sm, fontWeight: '800' },
  rowDate: { fontSize: 11 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: font.sm + 1, fontWeight: '700' },
  rowMeta: { fontSize: font.xs },
  rowState: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '800',
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    padding: space.lg,
    paddingBottom: space.xl,
  },
  sheetKind: { fontSize: font.xs, fontWeight: '800', letterSpacing: 0.4 },
  sheetTitle: { fontSize: font.lg, fontWeight: '800', marginTop: 2 },
  sheetRows: { borderTopWidth: 1, marginTop: space.md, paddingTop: space.sm, gap: 6 },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  detailLabel: { flex: 1, fontSize: font.sm },
  detailValue: { flex: 1.5, fontSize: font.sm, fontWeight: '700', textAlign: 'right' },
  mono: { fontSize: font.xs, letterSpacing: 0.2 },
  sheetNotes: { fontSize: font.sm, lineHeight: 19, marginTop: space.md },

  sheetActions: { gap: space.sm, marginTop: space.lg },
  primary: { borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  primaryText: { fontSize: font.sm, fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryText: { fontSize: font.sm, fontWeight: '800' },
  close: { alignItems: 'center', paddingVertical: 6 },
  closeText: { fontSize: font.sm, fontWeight: '700' },
});
