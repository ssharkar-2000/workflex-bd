import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupportTicket } from '@workflex/shared';
import { fetchTickets, respondToTicket } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Button, Card, StatTile } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

const FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;

export default function SupportScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const query = useQuery({
    queryKey: ['admin-support', filter],
    queryFn: () => fetchTickets(filter),
  });

  return (
    <SectionScreen
      title="Support"
      subtitle="Complaints and requests"
      query={query}
    >
      {(data) => (
        <>
          <View style={styles.grid}>
            <StatTile
              label="Open"
              value={String(data.open)}
              tone={data.open > 0 ? 'warning' : 'default'}
            />
            <StatTile label="All tickets" value={String(data.total)} />
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

          {data.tickets.length === 0 ? (
            <Card>
              <Text style={styles.muted}>
                No tickets. These arrive when a user submits a complaint from
                the app — that form is part of the worker-app support module,
                still to be built, so the table stays empty until then.
              </Text>
            </Card>
          ) : (
            data.tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
          )}
        </>
      )}
    </SectionScreen>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const queryClient = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [response, setResponse] = useState(ticket.response ?? '');

  const respond = useMutation({
    mutationFn: (status: 'IN_PROGRESS' | 'RESOLVED') =>
      respondToTicket(ticket.id, response, status),
    onSuccess: () => {
      setReplying(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-support'] });
    },
    onError: (err) => Alert.alert('Could not save', errorText(err)),
  });

  const tone =
    ticket.status === 'OPEN'
      ? 'warning'
      : ticket.status === 'RESOLVED'
        ? 'success'
        : ticket.status === 'CLOSED'
          ? 'neutral'
          : 'info';

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.subject}>{ticket.subject}</Text>
        <Badge text={ticket.status.replace('_', ' ')} tone={tone} />
      </View>
      <Text style={styles.meta}>
        {ticket.userName ?? 'Anonymous'}
        {ticket.userPhone ? ` · ${ticket.userPhone}` : ''} ·{' '}
        {ticket.priority.toLowerCase()}
      </Text>
      <Text style={styles.message}>{ticket.message}</Text>

      {ticket.response && !replying ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Reply sent</Text>
          <Text style={styles.replyText}>{ticket.response}</Text>
        </View>
      ) : null}

      {replying ? (
        <>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={response}
            onChangeText={setResponse}
            placeholder="Write a reply"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <View style={styles.actionRow}>
            <View style={styles.grow}>
              <Button
                label="Resolve"
                onPress={() => respond.mutate('RESOLVED')}
                loading={respond.isPending}
                disabled={response.trim().length < 3}
              />
            </View>
            <View style={styles.grow}>
              <Button
                label="Cancel"
                tone="outline"
                onPress={() => setReplying(false)}
              />
            </View>
          </View>
        </>
      ) : ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
        <View style={styles.actionRow}>
          <View style={styles.grow}>
            <Button label="Reply" onPress={() => setReplying(true)} />
          </View>
        </View>
      ) : null}
    </Card>
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
  subject: { flex: 1, fontSize: font.sm, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 4 },
  message: {
    fontSize: font.sm,
    color: colors.text,
    lineHeight: 19,
    marginTop: space.sm,
  },
  replyBox: {
    marginTop: space.md,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: space.md,
  },
  replyLabel: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.success,
    marginBottom: 4,
  },
  replyText: { fontSize: font.xs, color: colors.textMuted, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    marginTop: space.md,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  grow: { flex: 1 },
  muted: { color: colors.textMuted, fontSize: font.sm, lineHeight: 19 },
});
