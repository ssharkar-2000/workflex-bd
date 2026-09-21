import React, { useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Page, VerificationRequest, VerificationType } from '../api/types';
import { Avatar, Button, ErrorState, Loading, SectionHeader } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { humanise, longDate } from '../theme/format';

const TYPE_LABEL: Record<VerificationType, string> = {
  NID: 'NID Verification',
  FACE: 'Face Verification',
  BUSINESS: 'Business Verification',
  WORKER: 'Worker Verification',
  EMPLOYER: 'Employer Verification',
  COMPANY: 'Company Verification',
};

export function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<VerificationType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useApi<{ total: number; byType: { type: VerificationType; pending: number }[] }>(
    '/verifications/pending-by-type',
  );
  const { data, loading, error, refetch } = useApi<Page<VerificationRequest>>(
    `/verifications${type ? `?type=${type}` : ''}`,
    [type],
  );

  const review = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      await api(`/verifications/${id}/${action}`, { method: 'POST', body: {} });
      await Promise.all([refetch(), counts.refetch()]);
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
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
            <Text style={text.screenTitle}>Verification Center</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {counts.data?.total ?? 0} pending verifications need review
            </Text>

            <View style={s.grid}>
              {(counts.data?.byType ?? []).map((entry) => {
                const active = type === entry.type;
                return (
                  <Pressable
                    key={entry.type}
                    onPress={() => setType(active ? null : entry.type)}
                    style={[s.tile, shadow.card, active && s.tileActive]}
                  >
                    <Text style={[s.tileLabel, active && s.tileLabelActive]} numberOfLines={2}>
                      {TYPE_LABEL[entry.type]}
                    </Text>
                    <Text style={[s.tileCount, active && s.tileLabelActive]}>
                      {entry.pending} pending
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title={type ? TYPE_LABEL[type] : 'Pending Queue'} />
            </View>
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <View style={s.empty}>
              <Text style={text.cardTitle}>Queue is clear</Text>
              <Text style={[text.caption, { marginTop: spacing.xs }]}>
                Nothing is waiting on review here.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[s.card, shadow.card]}>
            <View style={s.row}>
              <Avatar
                initials={item.subjectName
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
                size={40}
              />
              <View style={s.grow}>
                <Text style={text.cardTitle}>{item.subjectName}</Text>
                <Text style={text.caption}>
                  {humanise(item.type)} · {longDate(item.submittedAt)}
                </Text>
              </View>
            </View>
            <View style={s.actions}>
              <Button
                label="Reject"
                variant="danger"
                loading={busyId === item.id}
                onPress={() => review(item.id, 'reject')}
              />
              <Button
                label="Approve"
                variant="success"
                loading={busyId === item.id}
                onPress={() => review(item.id, 'approve')}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tileActive: { backgroundColor: colors.primary },
  tileLabel: { ...text.label },
  tileLabelActive: { color: colors.onPrimary },
  tileCount: { ...text.caption, color: colors.primary, fontWeight: '700' },

  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
});
