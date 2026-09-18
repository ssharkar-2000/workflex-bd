import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchAttendance } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Card, StatTile } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

const FILTERS = ['ALL', 'CHECKED_IN', 'CHECKED_OUT', 'LATE', 'ABSENT'] as const;

export default function AttendanceScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const query = useQuery({
    queryKey: ['admin-attendance', filter],
    queryFn: () => fetchAttendance(filter),
  });

  return (
    <SectionScreen
      title="Attendance"
      subtitle="Shift check-ins"
      query={query}
    >
      {(data) => (
        <>
          <View style={styles.grid}>
            <StatTile label="Today" value={String(data.today)} />
            <StatTile label="All records" value={String(data.total)} />
          </View>

          <View style={styles.chipRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, filter === f && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, filter === f && styles.chipTextActive]}
                >
                  {f.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          {data.rows.length === 0 ? (
            <Card>
              <Text style={styles.muted}>
                No attendance records. The table, filters and API are live —
                records appear once workers can check in from the app, which
                arrives with the jobs module (attendance is attendance at a
                shift, so it needs a shift to attach to).
              </Text>
            </Card>
          ) : (
            data.rows.map((r) => (
              <Card key={r.id}>
                <View style={styles.head}>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{r.userName}</Text>
                    <Text style={styles.meta}>{r.userPhone}</Text>
                  </View>
                  <Badge
                    text={r.status.replace('_', ' ')}
                    tone={
                      r.status === 'CHECKED_IN'
                        ? 'success'
                        : r.status === 'LATE'
                          ? 'warning'
                          : r.status === 'ABSENT'
                            ? 'danger'
                            : 'neutral'
                    }
                  />
                </View>
                <Text style={styles.times}>
                  In {new Date(r.checkInAt).toLocaleString()}
                  {r.checkOutAt
                    ? ` · Out ${new Date(r.checkOutAt).toLocaleString()}`
                    : ' · still on shift'}
                </Text>
                {r.note ? <Text style={styles.note}>{r.note}</Text> : null}
              </Card>
            ))
          )}
        </>
      )}
    </SectionScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  chipRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  name: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  times: { fontSize: font.xs, color: colors.textMuted, marginTop: space.sm },
  note: { fontSize: font.xs, color: colors.text, marginTop: 4 },
  muted: { color: colors.textMuted, fontSize: font.sm, lineHeight: 19 },
});
