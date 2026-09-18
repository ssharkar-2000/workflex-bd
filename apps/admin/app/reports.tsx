import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchReport } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Card, StatTile } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

export default function ReportsScreen() {
  const query = useQuery({ queryKey: ['admin-report'], queryFn: fetchReport });

  return (
    <SectionScreen
      title="Reports"
      subtitle="Platform summary"
      query={query}
    >
      {(data) => (
        <>
          <Text style={styles.generated}>
            Generated {new Date(data.generatedAt).toLocaleString()}
          </Text>

          <Text style={styles.sectionTitle}>Accounts</Text>
          <View style={styles.grid}>
            <StatTile label="Total" value={String(data.users.total)} />
            <StatTile label="Workers" value={String(data.users.workers)} />
            <StatTile label="Employers" value={String(data.users.employers)} />
            <StatTile
              label="New this week"
              value={String(data.users.newThisWeek)}
              tone="success"
            />
            <StatTile
              label="Suspended"
              value={String(data.users.suspended)}
              tone={data.users.suspended > 0 ? 'danger' : 'default'}
            />
          </View>

          <Text style={styles.sectionTitle}>Verification</Text>
          <View style={styles.grid}>
            <StatTile
              label="Approved"
              value={String(data.verification.approved)}
              tone="success"
            />
            <StatTile
              label="Pending"
              value={String(data.verification.pending)}
              tone="warning"
            />
            <StatTile
              label="Rejected"
              value={String(data.verification.rejected)}
              tone="danger"
            />
          </View>

          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.grid}>
            <StatTile label="Open" value={String(data.support.open)} />
            <StatTile label="Resolved" value={String(data.support.resolved)} />
          </View>

          <Text style={styles.sectionTitle}>CSV</Text>
          <Card>
            <Text style={styles.hint}>
              The same figures in a form you can paste into a spreadsheet.
              Long-press to select and copy.
            </Text>
            <View style={styles.csvBox}>
              <Text selectable style={styles.csv}>
                {data.csv}
              </Text>
            </View>
          </Card>
        </>
      )}
    </SectionScreen>
  );
}

const styles = StyleSheet.create({
  generated: { fontSize: font.xs, color: colors.textFaint },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginTop: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  hint: {
    fontSize: font.xs,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: space.md,
  },
  csvBox: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: space.md,
  },
  csv: {
    fontSize: font.xs,
    color: colors.text,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
