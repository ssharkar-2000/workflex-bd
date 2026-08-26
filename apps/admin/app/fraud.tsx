import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchFraud } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Card } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

function band(score: number): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (score >= 60) return { label: 'High risk', tone: 'danger' };
  if (score >= 30) return { label: 'Review', tone: 'warning' };
  return { label: 'Low', tone: 'neutral' };
}

export default function FraudScreen() {
  const query = useQuery({ queryKey: ['admin-fraud'], queryFn: fetchFraud });

  return (
    <SectionScreen
      title="Fraud Detection"
      subtitle="Risk scored from document checks"
      query={query}
    >
      {(data) => (
        <>
          <Card>
            <Text style={styles.lead}>
              {data.flagged === 0
                ? 'No accounts are currently flagged.'
                : `${data.flagged} account${data.flagged === 1 ? '' : 's'} flagged.`}
            </Text>
            <Text style={styles.note}>
              Scores come from the automated document checks, and every point
              is listed with its reason. Treat this as a queue to look at, not
              a verdict — a blurry photo and a forged card can score alike.
            </Text>
          </Card>

          {data.signals.map((s) => {
            const b = band(s.riskScore);
            return (
              <Card key={s.userId}>
                <View style={styles.head}>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{s.userName}</Text>
                    <Text style={styles.meta}>{s.userPhone}</Text>
                  </View>
                  <View style={styles.scoreWrap}>
                    <Text style={[styles.score, { color: colors[b.tone === 'danger' ? 'danger' : b.tone === 'warning' ? 'warning' : 'textMuted'] }]}>
                      {s.riskScore}
                    </Text>
                    <Badge text={b.label} tone={b.tone} />
                  </View>
                </View>

                <View style={styles.reasons}>
                  {s.reasons.map((r, i) => (
                    <View key={i} style={styles.reasonRow}>
                      <View style={styles.dot} />
                      <Text style={styles.reason}>{r}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </>
      )}
    </SectionScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: font.md, fontWeight: '800', color: colors.text },
  note: {
    fontSize: font.xs,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  name: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  scoreWrap: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: font.lg, fontWeight: '800' },

  reasons: { marginTop: space.md, gap: 6 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.textFaint,
    marginTop: 6,
  },
  reason: { flex: 1, fontSize: font.xs, color: colors.textMuted, lineHeight: 17 },
});
