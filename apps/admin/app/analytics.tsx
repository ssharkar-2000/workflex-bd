import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalytics } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Card } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

export default function AnalyticsScreen() {
  const query = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: fetchAnalytics,
  });

  return (
    <SectionScreen title="Analytics" subtitle="Last 14 days" query={query}>
      {(data) => {
        const peak = Math.max(1, ...data.signupsByDay.map((d) => d.count));
        const funnel = data.verificationFunnel;

        return (
          <>
            <Card>
              <Text style={styles.cardTitle}>Sign-ups per day</Text>
              <View style={styles.chart}>
                {data.signupsByDay.map((d) => (
                  <View key={d.date} style={styles.barCol}>
                    <Text style={styles.barValue}>
                      {d.count > 0 ? d.count : ''}
                    </Text>
                    <View
                      style={[
                        styles.bar,
                        {
                          // Floor of 3px so an empty day still reads as a
                          // day rather than disappearing from the axis.
                          height: Math.max(3, (d.count / peak) * 90),
                          backgroundColor:
                            d.count > 0 ? colors.primary : colors.border,
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>{d.date.slice(8)}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Account mix</Text>
              <Row label="Workers" value={data.accountTypeSplit.individual} />
              <Row label="Employers" value={data.accountTypeSplit.company} />
              <Row
                label="Not yet chosen"
                value={data.accountTypeSplit.unset}
                muted
              />
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Verification funnel</Text>
              <Text style={styles.cardHint}>
                Where accounts stop. The gap between steps is the drop-off.
              </Text>
              <FunnelRow
                label="Registered"
                value={funnel.registered}
                max={funnel.registered}
              />
              <FunnelRow
                label="Profile complete"
                value={funnel.profileComplete}
                max={funnel.registered}
              />
              <FunnelRow
                label="Documents uploaded"
                value={funnel.documentsUploaded}
                max={funnel.registered}
              />
              <FunnelRow
                label="Submitted for review"
                value={funnel.submitted}
                max={funnel.registered}
              />
              <FunnelRow
                label="Approved"
                value={funnel.approved}
                max={funnel.registered}
              />
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Email adoption</Text>
              <Row label="Added an email" value={data.emailAdoption.withEmail} />
              <Row label="Verified it" value={data.emailAdoption.verified} />
            </Card>
          </>
        );
      }}
    </SectionScreen>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && { color: colors.textFaint }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, muted && { color: colors.textFaint }]}>
        {value}
      </Text>
    </View>
  );
}

function FunnelRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View style={styles.funnelRow}>
      <View style={styles.funnelHead}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>
          {value} · {pct}%
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, pct)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.sm,
  },
  cardHint: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginBottom: space.md,
    lineHeight: 17,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    marginTop: space.sm,
  },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: 10, borderRadius: 3 },
  barValue: { fontSize: 9, color: colors.text, fontWeight: '700', height: 12 },
  barLabel: { fontSize: 9, color: colors.textFaint, marginTop: 4 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  rowLabel: { fontSize: font.sm, color: colors.textMuted },
  rowValue: { fontSize: font.sm, fontWeight: '800', color: colors.text },

  funnelRow: { marginTop: space.md },
  funnelHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: {
    height: 8,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.pill,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: { height: 8, backgroundColor: colors.primary, borderRadius: radius.pill },
});
