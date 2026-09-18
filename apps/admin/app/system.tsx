import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchSystem } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Card, StatTile } from '../src/components/ui';
import { colors, font, space } from '../src/lib/theme';

function humanUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SystemScreen() {
  const query = useQuery({ queryKey: ['admin-system'], queryFn: fetchSystem });

  return (
    <SectionScreen
      title="System Management"
      subtitle="Runtime and configuration"
      query={query}
    >
      {(data) => (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>Database</Text>
              <Badge
                text={data.database === 'up' ? 'Connected' : 'Down'}
                tone={data.database === 'up' ? 'success' : 'danger'}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>API uptime</Text>
              <Text style={styles.value}>
                {humanUptime(data.uptimeSeconds)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Environment</Text>
              <Text style={styles.value}>{data.environment}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Node</Text>
              <Text style={styles.value}>{data.nodeVersion}</Text>
            </View>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Delivery providers</Text>
            <View style={styles.row}>
              <Text style={styles.label}>SMS</Text>
              <Badge
                text={data.smsProvider}
                tone={data.smsIsDevProvider ? 'warning' : 'success'}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Badge text={data.mailProvider} tone="info" />
            </View>
            {data.smsIsDevProvider ? (
              <Text style={styles.warn}>
                SMS codes are being written to a log file, not delivered. Fine
                for development; the API refuses to start in production with
                this setting.
              </Text>
            ) : null}
          </Card>

          <Text style={styles.sectionTitle}>Table sizes</Text>
          <View style={styles.grid}>
            <StatTile label="Users" value={String(data.counts.users)} />
            <StatTile label="Documents" value={String(data.counts.documents)} />
            <StatTile label="Tickets" value={String(data.counts.tickets)} />
            <StatTile
              label="Notifications"
              value={String(data.counts.notifications)}
            />
          </View>
        </>
      )}
    </SectionScreen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  label: { fontSize: font.sm, color: colors.textMuted },
  value: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  warn: {
    fontSize: font.xs,
    color: colors.warningText,
    lineHeight: 17,
    marginTop: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
