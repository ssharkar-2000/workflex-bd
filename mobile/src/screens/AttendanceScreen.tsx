import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Avatar, BackButton, Button, EmptyState, ErrorState, FilterTabs, Loading, Meter, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

type AttendanceRecord = {
  id: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
  checkInAt: string | null;
  checkOutAt: string | null;
  workingHours: number | null;
  gpsFlagged: boolean;
  worker: { id: string; fullName: string; initials: string; profession: string };
  job: { id: string; title: string } | null;
};

type Summary = {
  date: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  gpsFlagged: number;
  attendanceRate: number;
};

type Filter = 'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';

/// "2026-08-17T08:12:00Z" -> "8:12 AM"
function clock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function AttendanceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const summary = useApi<Summary>('/attendance/summary');
  const query = filter === 'ALL' ? '' : `?status=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<AttendanceRecord>>(
    `/attendance${query}`,
    [filter],
  );

  const checkOut = async (id: string) => {
    setBusyId(id);
    try {
      await api(`/attendance/${id}/check-out`, { method: 'POST' });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('attendance.couldNotCheckOut'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={text.screenTitle}>{t('attendance.title')}</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {summary.data?.date ?? t('attendance.today')}
            </Text>

            {summary.data ? (
              <View style={[s.summary, shadow.card]}>
                <View style={s.rateRow}>
                  <Text style={text.label}>{t('attendance.attendanceRate')}</Text>
                  <Text style={s.rate}>{summary.data.attendanceRate}%</Text>
                </View>
                <Meter percent={summary.data.attendanceRate} color={colors.greenText} />

                <View style={s.tiles}>
                  <Tile value={summary.data.present} label={t('attendance.present')} color={colors.greenText} text={text} styles={s} />
                  <Tile value={summary.data.late} label={t('attendance.late')} color={colors.amber} text={text} styles={s} />
                  <Tile value={summary.data.absent} label={t('attendance.absent')} color={colors.red} text={text} styles={s} />
                  <Tile value={summary.data.onLeave} label={t('attendance.onLeave')} color={colors.slate} text={text} styles={s} />
                </View>

                {summary.data.gpsFlagged > 0 ? (
                  <View style={s.flagged}>
                    <Text style={s.flaggedText}>
                      {t('attendance.gpsFlaggedWarning', { count: summary.data.gpsFlagged })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <FilterTabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: t('common.all') },
                { value: 'PRESENT', label: t('attendance.present') },
                { value: 'LATE', label: t('attendance.late') },
                { value: 'ABSENT', label: t('attendance.absent') },
                { value: 'ON_LEAVE', label: t('attendance.leave') },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <EmptyState title={t('attendance.emptyTitle')} hint={t('attendance.emptyHint')} />
          )
        }
        renderItem={({ item }) => (
          <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
            <Pressable
              onPress={() => navigation.navigate('WorkerProfile', { id: item.worker.id })}
              style={s.cardTop}
            >
              <Avatar initials={item.worker.initials} size={40} />
              <View style={s.grow}>
                <View style={s.row}>
                  <Text style={text.cardTitle} numberOfLines={1}>
                    {item.worker.fullName}
                  </Text>
                  <StatusPill value={item.status} />
                </View>
                <Text style={text.caption} numberOfLines={1}>
                  {item.job?.title ?? item.worker.profession}
                </Text>
                <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={1}>
                  {t('attendance.inOut', { in: clock(item.checkInAt), out: clock(item.checkOutAt) })}
                  {item.workingHours !== null ? ` · ${t('attendance.hoursWorked', { hours: item.workingHours })}` : ''}
                  {item.gpsFlagged ? `  ⚠ ${t('attendance.gpsShort')}` : ''}
                </Text>
              </View>
            </Pressable>
            {item.checkInAt && !item.checkOutAt ? (
              <Button
                label={t('attendance.checkOut')}
                variant="outline"
                loading={busyId === item.id}
                onPress={() => checkOut(item.id)}
                style={s.checkOutButton}
              />
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

function Tile({
  value,
  label,
  color,
  text,
  styles,
}: {
  value: number;
  label: string;
  color: string;
  text: ReturnType<typeof buildText>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={text.micro}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    summary: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rate: { fontSize: 18, fontWeight: '700', color: colors.greenText },
    tiles: { flexDirection: 'row', marginTop: spacing.md },
    tile: { flex: 1, alignItems: 'center' },
    tileValue: { fontSize: 18, fontWeight: '700' },
    flagged: {
      backgroundColor: colors.amberBg,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    flaggedText: { ...text.caption, color: colors.amberText, fontWeight: '600' },

    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    checkOutButton: { alignSelf: 'flex-start' },
    grow: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  });
}
