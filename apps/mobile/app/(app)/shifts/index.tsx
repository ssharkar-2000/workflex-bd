import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatTaka,
  type Shift,
  type ShiftFilter,
  type ShiftList,
  type ShiftSide,
} from '@workflex/shared';
import { fetchShifts } from '../../../src/api/shifts';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShiftCalendar } from '../../../src/components/shifts/ShiftCalendar';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

const FILTERS: ShiftFilter[] = ['UPCOMING', 'TODAY', 'COMPLETED', 'CANCELLED'];

/**
 * The shifts this account works, and the shifts it posted.
 *
 * Two tabs over one list rather than two screens: it is the same person
 * either way, and someone who both works and hires should not have to
 * remember which menu leads to which half of their week.
 */
export default function ShiftsScreen() {
  const t = useT();
  const { c } = useTheme();
  const client = useQueryClient();
  const errorMessage = useErrorMessage();

  const [side, setSide] = useState<ShiftSide>('WORK');
  const [filter, setFilter] = useState<ShiftFilter>('UPCOMING');

  const list = useQuery<ShiftList>({
    queryKey: ['shifts', side, filter],
    queryFn: () => fetchShifts(side, filter),
  });

  const counts = list.data?.counts;

  return (
    <MoneyScreen
      title={t('shifts.title')}
      refreshing={list.isRefetching}
      // One pull refreshes both halves of the page, now that the month sits
      // above the list rather than on a screen of its own.
      onRefresh={() => {
        void list.refetch();
        void client.invalidateQueries({ queryKey: ['calendar'] });
      }}
    >
      {/* The same week, read two ways: the month first, then the list. The
          calendar used to sit behind a button here, which meant the one view
          that shows interviews alongside shifts was the one nobody opened. */}
      <ShiftCalendar />

      <Text style={[s.listTitle, { color: c.text }]}>{t('shifts.listTitle')}</Text>

      <View style={[s.tabs, { backgroundColor: c.surfaceAlt }]}>
        {(['WORK', 'POSTED'] as ShiftSide[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => setSide(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === option }}
            style={[s.tab, side === option && { backgroundColor: c.primary }]}
          >
            <Text style={[s.tabText, { color: side === option ? c.primaryText : c.textMuted }]}>
              {t(`shifts.side.${option}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.summary, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Figure label={t('shifts.upcoming')} value={counts?.upcoming} />
        <Figure label={t('shifts.today')} value={counts?.today} />
        <Figure label={t('shifts.completed')} value={counts?.completed} />
      </View>

      <View style={s.filters}>
        {FILTERS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setFilter(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === option }}
            style={[
              s.filter,
              {
                backgroundColor: filter === option ? c.primarySoft : 'transparent',
                borderColor: filter === option ? c.primarySoftBorder : c.border,
              },
            ]}
          >
            <Text
              style={[s.filterText, { color: filter === option ? c.primary : c.textMuted }]}
            >
              {t(`shifts.filter.${option}` as TranslationKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {list.error ? <ErrorBanner message={errorMessage(list.error)} tone="onSurface" /> : null}

      {list.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (list.data?.shifts.length ?? 0) === 0 ? (
        <Text style={[s.empty, { color: c.textMuted }]}>
          {t(`shifts.empty.${side}` as TranslationKey)}
        </Text>
      ) : (
        list.data!.shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} side={side} />)
      )}
    </MoneyScreen>
  );
}

function Figure({ label, value }: { label: string; value: number | undefined }) {
  const { c } = useTheme();
  return (
    <View style={s.figure}>
      <Text style={[s.figureValue, { color: c.text }]}>{value ?? '—'}</Text>
      <Text style={[s.figureLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

function ShiftCard({ shift, side }: { shift: Shift; side: ShiftSide }) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const starts = new Date(shift.startsAt);
  const ends = new Date(shift.endsAt);
  const tone = STATUS_TONE(shift.status, c);

  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>
        {shift.job.title}
      </Text>
      <Text style={[s.cardWho, { color: c.textMuted }]} numberOfLines={1}>
        {side === 'WORK'
          ? (shift.employer.company ?? shift.employer.name)
          : shift.worker.name}
      </Text>

      <View style={s.rows}>
        <Row text={dayLabel(starts, t)} />
        <Row text={`${clock(starts)} – ${clock(ends)}`} />
        <Row text={shift.location} />
        <Row text={formatTaka(shift.earnings?.total ?? shift.pay)} />
      </View>

      <View style={s.statusRow}>
        <Text style={[s.status, { color: tone }]}>
          ● {t(`shifts.status.${shift.status}` as TranslationKey)}
        </Text>
        <Text style={[s.countdown, { color: c.textMuted }]}>
          {countdown(shift, t)}
        </Text>
      </View>

      <Pressable
        onPress={() =>
          router.push({ pathname: '/(app)/shifts/[id]', params: { id: shift.id } })
        }
        accessibilityRole="button"
        style={({ pressed }) => [
          s.cardButton,
          { backgroundColor: pressed ? c.primaryPressed : c.primary },
        ]}
      >
        <Text style={[s.cardButtonText, { color: c.primaryText }]}>
          {t('shifts.viewDetails')}
        </Text>
      </Pressable>
    </View>
  );
}

function Row({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowText, { color: c.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** "5:00 PM" — the way shift times are spoken here. */
export function clock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function dayLabel(date: Date, t: (key: TranslationKey) => string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return t('shifts.dayToday');
  if (diff === 1) return t('shifts.dayTomorrow');
  if (diff === -1) return t('shifts.dayYesterday');
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Starts in 2h 15m", "Worked 1h 24m", or nothing once it is over. */
export function countdown(
  shift: Shift,
  t: (key: TranslationKey, vars?: Record<string, string>) => string,
): string {
  if (shift.status === 'COMPLETED' || shift.status === 'CANCELLED') return '';

  if (shift.status === 'IN_PROGRESS' && shift.attendance) {
    return t('shifts.worked', { time: duration(shift.attendance.workedMinutes) });
  }

  const minutes = Math.round((new Date(shift.startsAt).getTime() - Date.now()) / 60_000);
  if (minutes <= 0) return t('shifts.startedAlready');
  if (minutes > 60 * 48) return '';
  return t('shifts.startsIn', { time: duration(minutes) });
}

export function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

export function STATUS_TONE(
  status: Shift['status'],
  c: { success: string; warning: string; danger: string; textMuted: string },
): string {
  switch (status) {
    case 'IN_PROGRESS':
      return c.success;
    case 'CONFIRMED':
      return c.warning;
    case 'CANCELLED':
    case 'NO_SHOW':
      return c.danger;
    default:
      return c.textMuted;
  }
}

const s = StyleSheet.create({
  listTitle: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.sm },
  tabs: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginTop: space.md },
  tab: { flex: 1, borderRadius: radius.pill, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: font.sm, fontWeight: '800' },

  summary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    marginTop: space.md,
  },
  figure: { flex: 1, alignItems: 'center', gap: 2 },
  figureValue: { fontSize: font.xl, fontWeight: '800' },
  figureLabel: { fontSize: font.xs },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  filter: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7 },
  filterText: { fontSize: font.xs, fontWeight: '800' },

  loading: { marginTop: space.lg },
  empty: { fontSize: font.sm, lineHeight: 20, marginTop: space.lg },

  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md, gap: 2 },
  cardTitle: { fontSize: font.md, fontWeight: '800' },
  cardWho: { fontSize: font.sm },
  rows: { marginTop: space.sm, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowText: { flex: 1, fontSize: font.sm },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  status: { fontSize: font.xs, fontWeight: '800' },
  countdown: { fontSize: font.xs },

  cardButton: {
    marginTop: space.md,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cardButtonText: { fontSize: font.sm, fontWeight: '800' },
});
