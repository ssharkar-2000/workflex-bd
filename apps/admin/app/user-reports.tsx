import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminReport, ReportCategory, ReportStatus } from '@workflex/shared';
import { fetchReports, resolveReport } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Button, Card, StatTile } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

const FILTERS = ['ALL', 'OPEN', 'IN_REVIEW', 'ACTION_TAKEN', 'DISMISSED'] as const;

/**
 * Short labels for the queue. The full sentences live in the worker app —
 * a reviewer scanning forty rows needs a word, not a description.
 */
const CATEGORY_LABELS: Record<ReportCategory, string> = {
  FRAUD: 'Fraud',
  NON_PAYMENT: 'Not paid',
  MISLEADING_PAY: 'Pay mismatch',
  FAKE_JOB: 'Fake job',
  HARASSMENT: 'Harassment',
  UNSAFE_WORK: 'Unsafe work',
  FAKE_PROFILE: 'Fake identity',
  TECHNICAL: 'App problem',
  OTHER: 'Other',
};

/**
 * The categories that mean someone has lost money or is at risk. Flagged in
 * the list so a reviewer opening the queue sees them before deciding what to
 * read first — the sort already puts oldest first, which is fair but not
 * urgency-aware on its own.
 */
const SERIOUS: ReportCategory[] = [
  'FRAUD',
  'NON_PAYMENT',
  'HARASSMENT',
  'UNSAFE_WORK',
];

export default function UserReportsScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('OPEN');
  const query = useQuery({
    queryKey: ['admin-reports', filter],
    queryFn: () => fetchReports(filter),
  });

  return (
    <SectionScreen
      title="User reports"
      subtitle="Fraud, unpaid work and misconduct"
      query={query}
    >
      {(data) => (
        <>
          <View style={styles.grid}>
            <StatTile
              label="Awaiting review"
              value={String(data.open)}
              tone={data.open > 0 ? 'warning' : 'default'}
            />
            <StatTile label="All reports" value={String(data.total)} />
          </View>

          {/* Per-category counts across everything still open, so the queue
              can be triaged before a single report is opened. */}
          {Object.keys(data.byCategory).length > 0 ? (
            <Card>
              <Text style={styles.cardTitle}>Open by category</Text>
              <View style={styles.categoryRow}>
                {Object.entries(data.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => (
                    <View
                      key={key}
                      style={[
                        styles.categoryChip,
                        SERIOUS.includes(key as ReportCategory) &&
                          styles.categoryChipSerious,
                      ]}
                    >
                      <Text style={styles.categoryChipText}>
                        {CATEGORY_LABELS[key as ReportCategory]} {count}
                      </Text>
                    </View>
                  ))}
              </View>
            </Card>
          ) : null}

          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filter, filter === f && styles.filterOn]}
              >
                <Text
                  style={[styles.filterText, filter === f && styles.filterTextOn]}
                >
                  {f.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          {data.reports.length === 0 ? (
            <Card>
              <Text style={styles.empty}>Nothing in this queue.</Text>
            </Card>
          ) : (
            data.reports.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))
          )}
        </>
      )}
    </SectionScreen>
  );
}

function ReportRow({ report }: { report: AdminReport }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState(report.response ?? '');
  const [open, setOpen] = useState(false);

  const act = useMutation({
    mutationFn: (status: ReportStatus) =>
      resolveReport(report.id, status, reply.trim() || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => Alert.alert('Could not update', errorText(err)),
  });

  const serious = SERIOUS.includes(report.category);
  const settled =
    report.status === 'ACTION_TAKEN' || report.status === 'DISMISSED';

  return (
    <Card>
      <View style={styles.rowTop}>
        <Text style={styles.subject} numberOfLines={2}>
          {serious ? '🔴 ' : ''}
          {report.subject}
        </Text>
        <Badge
          text={report.status.replace('_', ' ')}
          tone={
            report.status === 'ACTION_TAKEN'
              ? 'success'
              : report.status === 'DISMISSED'
                ? 'neutral'
                : 'warning'
          }
        />
      </View>

      <Text style={styles.meta}>
        {CATEGORY_LABELS[report.category]} · reported by {report.reporterName ?? 'Unnamed'}{' '}
        ({report.reporterPhone}) · {new Date(report.createdAt).toLocaleDateString()}
      </Text>

      {/* Who or what was reported. Without this the reviewer has to read the
          description to learn whether anyone can even be acted against. */}
      {report.targetPhone ? (
        <Text style={styles.target}>Reported party: {report.targetPhone}</Text>
      ) : null}
      {report.targetJobTitle ? (
        <Text style={styles.target}>Job: {report.targetJobTitle}</Text>
      ) : report.targetJobId ? (
        <Text style={styles.target}>Job: no longer listed</Text>
      ) : null}

      <Text style={styles.details}>{report.details}</Text>

      {report.response && !open ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>REPLY SENT</Text>
          <Text style={styles.replyText}>{report.response}</Text>
        </View>
      ) : null}

      {open ? (
        <>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Reply to the reporter (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button
              label="Mark reviewing"
              onPress={() => act.mutate('IN_REVIEW')}
              loading={act.isPending}
              tone="outline"
            />
            <Button
              label="Action taken"
              onPress={() => act.mutate('ACTION_TAKEN')}
              loading={act.isPending}
            />
            <Button
              label="Dismiss"
              onPress={() => act.mutate('DISMISSED')}
              loading={act.isPending}
              tone="outline"
            />
          </View>
        </>
      ) : (
        <Pressable onPress={() => setOpen(true)} style={styles.handle}>
          <Text style={styles.handleText}>
            {settled ? 'Reopen / change decision' : 'Handle this report'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cardTitle: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: '800',
    marginBottom: space.sm,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryChipSerious: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  categoryChipText: { color: colors.text, fontSize: font.xs, fontWeight: '700' },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.sm },
  filter: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700' },
  filterTextOn: { color: colors.primaryText },

  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  subject: { flex: 1, color: colors.text, fontSize: font.md, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: font.xs, marginTop: 6 },
  target: { color: colors.text, fontSize: font.xs, fontWeight: '700', marginTop: 4 },
  details: { color: colors.textMuted, fontSize: font.sm, lineHeight: 20, marginTop: 10 },

  replyBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 10,
    marginTop: 12,
  },
  replyLabel: { color: colors.primary, fontSize: font.xs, fontWeight: '800' },
  replyText: { color: colors.text, fontSize: font.sm, lineHeight: 20, marginTop: 3 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.sm,
    minHeight: 80,
    padding: 10,
    marginTop: 12,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },

  handle: { marginTop: 12 },
  handleText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: font.sm },
});
