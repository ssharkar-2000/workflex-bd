import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatTaka, type ShiftDetail } from '@workflex/shared';
import { checkIn, checkOut, fetchShift } from '../../../src/api/shifts';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { ShimmerButton } from '../../../src/components/ShimmerButton';
import { MoneyScreen, Notice } from '../../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';
import { clock, countdown, dayLabel, duration, STATUS_TONE } from './index';

/**
 * One shift, and the two buttons that matter while it is happening.
 *
 * Everything a person needs before turning up is on this screen — where,
 * when, who to ask for, what to wear, what to bring — because the moment
 * they need it is the moment they are standing outside a gate with one bar
 * of signal, not the evening before.
 */
export default function ShiftDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const shift = useQuery<ShiftDetail>({
    queryKey: ['shift', id],
    queryFn: () => fetchShift(id!),
    enabled: Boolean(id),
    // While a shift is running, the worked time on screen should keep up
    // with the clock without anyone pulling to refresh.
    refetchInterval: (query) => (query.state.data?.status === 'IN_PROGRESS' ? 60_000 : false),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['shift', id] });
    void queryClient.invalidateQueries({ queryKey: ['shifts'] });
  };

  const arrive = useMutation({ mutationFn: () => checkIn(id!, {}), onSuccess: refresh });
  const leave = useMutation({ mutationFn: () => checkOut(id!, {}), onSuccess: refresh });

  const data = shift.data;

  if (shift.isLoading || !data) {
    return (
      <MoneyScreen title={t('shifts.one')}>
        {shift.error ? (
          <ErrorBanner message={errorMessage(shift.error)} tone="onSurface" />
        ) : (
          <ActivityIndicator color={c.primary} style={s.loading} />
        )}
      </MoneyScreen>
    );
  }

  const starts = new Date(data.startsAt);
  const ends = new Date(data.endsAt);
  const mine = data.attendance;

  return (
    <MoneyScreen
      title={data.job.title}
      subtitle={data.employer.company ?? data.employer.name}
      refreshing={shift.isRefetching}
      onRefresh={refresh}
      footer={
        data.status === 'CONFIRMED' ? (
          <ShimmerButton
            label={t('shifts.checkIn')}
            onPress={() => arrive.mutate()}
            loading={arrive.isPending}
          />
        ) : data.status === 'IN_PROGRESS' ? (
          <ShimmerButton
            label={t('shifts.checkOut')}
            onPress={() => leave.mutate()}
            loading={leave.isPending}
          />
        ) : undefined
      }
    >
      {/* Where it has got to */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[s.status, { color: STATUS_TONE(data.status, c) }]}>
          ● {t(`shifts.status.${data.status}` as TranslationKey)}
        </Text>
        {countdown(data, t) ? (
          <Text style={[s.countdown, { color: c.text }]}>{countdown(data, t)}</Text>
        ) : null}

        {mine ? (
          <Text style={[s.attendance, { color: c.textMuted }]}>
            {t('shifts.startedAt', { time: clock(new Date(mine.checkInAt)) })}
            {mine.checkOutAt
              ? ` · ${t('shifts.endedAt', { time: clock(new Date(mine.checkOutAt)) })}`
              : ` · ${t('shifts.worked', { time: duration(mine.workedMinutes) })}`}
          </Text>
        ) : null}
      </View>

      {arrive.error ? <ErrorBanner message={errorMessage(arrive.error)} tone="onSurface" /> : null}
      {leave.error ? <ErrorBanner message={errorMessage(leave.error)} tone="onSurface" /> : null}

      {/* What it pays */}
      {data.earnings ? (
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.section, { color: c.text }]}>{t('shifts.earnings')}</Text>
          <Line label={t('shifts.basePay')} value={formatTaka(data.earnings.basePay)} />
          <Line label={t('shifts.overtime')} value={formatTaka(data.earnings.overtimePay)} />
          <Line label={t('shifts.bonus')} value={formatTaka(data.earnings.bonusPay)} />
          <View style={[s.total, { borderTopColor: c.border }]}>
            <Line label={t('shifts.total')} value={formatTaka(data.earnings.total)} strong />
          </View>
        </View>
      ) : null}

      {/* When and where */}
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Line label={t('shifts.date')} value={dayLabel(starts, t)} />
        <Line label={t('shifts.time')} value={`${clock(starts)} – ${clock(ends)}`} />
        <Line label={t('shifts.location')} value={data.location} />
        <Line label={t('shifts.pay')} value={formatTaka(data.pay)} />
        <Line
          label={t('shifts.attendanceMethod')}
          value={t(`shifts.method.${data.attendanceMethod}` as TranslationKey)}
        />

        <Pressable
          onPress={() => {
            const query = data.latitude
              ? `${data.latitude},${data.longitude}`
              : encodeURIComponent(data.location);
            const url =
              Platform.OS === 'ios'
                ? `http://maps.apple.com/?q=${query}`
                : `geo:0,0?q=${query}`;
            void Linking.openURL(url).catch(() => {});
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.secondary,
            { borderColor: c.primarySoftBorder, backgroundColor: pressed ? c.primarySoft : 'transparent' },
          ]}
        >
          <Text style={[s.secondaryText, { color: c.primary }]}>{t('shifts.navigate')}</Text>
        </Pressable>
      </View>

      {/* What to know before turning up */}
      {data.instructions || data.dressCode || data.requiredDocuments.length > 0 ? (
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.section, { color: c.text }]}>{t('shifts.beforeYouGo')}</Text>
          {data.instructions ? (
            <Text style={[s.body, { color: c.text }]}>{data.instructions}</Text>
          ) : null}
          {data.dressCode ? <Line label={t('shifts.dressCode')} value={data.dressCode} /> : null}
          {data.requiredDocuments.length > 0 ? (
            <Line label={t('shifts.bring')} value={data.requiredDocuments.join(', ')} />
          ) : null}
        </View>
      ) : null}

      {/* Who to ask for */}
      {data.contactName || data.contactPhone ? (
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.section, { color: c.text }]}>{t('shifts.contact')}</Text>
          {data.contactName ? <Line label={t('shifts.askFor')} value={data.contactName} /> : null}
          {data.contactPhone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${data.contactPhone}`).catch(() => {})}
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
                {t('shifts.call', { phone: data.contactPhone })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {data.cancellationPolicy ? (
        <Notice tone="info" title={t('shifts.cancellation')} body={data.cancellationPolicy} />
      ) : null}

      {data.status === 'CANCELLED' && data.cancelReason ? (
        <Notice tone="danger" title={t('shifts.cancelled')} body={data.cancelReason} />
      ) : null}

      {data.status === 'COMPLETED' ? (
        <Pressable
          onPress={() => router.push('/(app)/ratings')}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.secondary,
            {
              borderColor: c.primarySoftBorder,
              backgroundColor: pressed ? c.primarySoft : 'transparent',
              marginTop: space.md,
            },
          ]}
        >
          <Text style={[s.secondaryText, { color: c.primary }]}>{t('shifts.rate')}</Text>
        </Pressable>
      ) : null}
    </MoneyScreen>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={s.line}>
      <Text style={[s.lineLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.lineValue, { color: c.text }, strong && s.lineStrong]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  status: { fontSize: font.sm, fontWeight: '800' },
  countdown: { fontSize: font.lg, fontWeight: '800', marginTop: 2 },
  attendance: { fontSize: font.sm, marginTop: 4 },

  section: { fontSize: font.md, fontWeight: '800', marginBottom: space.sm },
  body: { fontSize: font.sm, lineHeight: 20, marginBottom: space.sm },

  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 5 },
  lineLabel: { flex: 1, fontSize: font.sm },
  lineValue: { flex: 1.4, fontSize: font.sm, fontWeight: '700', textAlign: 'right' },
  lineStrong: { fontSize: font.md, fontWeight: '800' },
  total: { borderTopWidth: 1, marginTop: 6, paddingTop: 4 },

  secondary: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: space.sm,
  },
  secondaryText: { fontSize: font.sm, fontWeight: '800' },
});
