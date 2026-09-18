import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchAiMonitoring } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Card, StatTile } from '../src/components/ui';
import { colors, font, space } from '../src/lib/theme';

/**
 * The "AI" here is the existing document pipeline — OCR, blur/glare scoring
 * and face matching — surfaced as outcomes. Nothing new runs for this screen;
 * it reads what the KYC uploads already produced.
 */
export default function AiMonitoringScreen() {
  const query = useQuery({
    queryKey: ['admin-ai'],
    queryFn: fetchAiMonitoring,
  });

  return (
    <SectionScreen
      title="AI Monitoring"
      subtitle="Automated document checks"
      query={query}
    >
      {(data) => (
        <>
          <View style={styles.grid}>
            <StatTile
              label="Passed"
              value={String(data.counts.passed)}
              tone="success"
            />
            <StatTile
              label="Needs review"
              value={String(data.counts.needsReview)}
              tone="warning"
            />
            <StatTile
              label="Failed"
              value={String(data.counts.failed)}
              tone="danger"
            />
            <StatTile label="Skipped" value={String(data.counts.skipped)} />
          </View>

          {data.counts.skipped > 0 ? (
            <Card>
              <Text style={styles.note}>
                Skipped checks mean a model was unavailable — usually the
                face-api weights, fetched with{' '}
                <Text style={styles.mono}>npm run models:fetch</Text>. Those
                documents were never scored, so they are not evidence of
                anything either way.
              </Text>
            </Card>
          ) : null}

          <Text style={styles.sectionTitle}>Recent checks</Text>
          {data.alerts.length === 0 ? (
            <Card>
              <Text style={styles.muted}>
                No documents have been analysed yet.
              </Text>
            </Card>
          ) : (
            data.alerts.map((a) => (
              <Card key={a.id}>
                <View style={styles.head}>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{a.userName}</Text>
                    <Text style={styles.meta}>
                      {a.userPhone} · {a.kind.replace('_', ' ')}
                    </Text>
                  </View>
                  <Badge
                    text={a.status.replace('_', ' ')}
                    tone={
                      a.status === 'PASSED'
                        ? 'success'
                        : a.status === 'FAILED'
                          ? 'danger'
                          : a.status === 'NEEDS_REVIEW'
                            ? 'warning'
                            : 'neutral'
                    }
                  />
                </View>

                <View style={styles.metrics}>
                  <Metric
                    label="Sharpness"
                    value={a.sharpness === null ? '—' : a.sharpness.toFixed(2)}
                  />
                  <Metric
                    label="Glare"
                    value={a.glare === null ? '—' : a.glare.toFixed(2)}
                  />
                  <Metric
                    label="Faces"
                    value={
                      a.facesDetected === null ? '—' : String(a.facesDetected)
                    }
                  />
                  <Metric
                    label="Face match"
                    value={a.faceMatch === null ? '—' : a.faceMatch.toFixed(2)}
                  />
                </View>

                {a.extractedNid || a.extractedName ? (
                  <Text style={styles.extracted}>
                    Read from card: {a.extractedName ?? '—'}
                    {a.extractedNid ? ` · ${a.extractedNid}` : ''}
                  </Text>
                ) : null}

                {a.notes ? <Text style={styles.notes}>{a.notes}</Text> : null}
              </Card>
            ))
          )}
        </>
      )}
    </SectionScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginTop: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  name: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 9, color: colors.textFaint, marginTop: 2 },
  extracted: {
    fontSize: font.xs,
    color: colors.text,
    marginTop: space.md,
  },
  notes: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: space.sm,
    lineHeight: 16,
  },
  note: { fontSize: font.xs, color: colors.textMuted, lineHeight: 18 },
  mono: { fontWeight: '800', color: colors.text },
  muted: { color: colors.textMuted, fontSize: font.sm },
});
