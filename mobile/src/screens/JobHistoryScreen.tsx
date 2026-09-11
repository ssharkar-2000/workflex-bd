import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { JobHistoryEntry } from '../api/types';
import { EmptyState, ErrorState, Loading } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { longDate } from '../theme/format';

export function JobHistoryScreen({ route }: any) {
  const { id, name } = route.params;
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<JobHistoryEntry[]>(`/workers/${id}/job-history`);

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Text style={text.screenTitle}>Job History</Text>
        <Text style={text.caption}>{name}</Text>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState title="No history yet" hint="Completed placements will appear here." />
          }
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card]}>
              <Text style={text.cardTitle}>{item.role}</Text>
              <Text style={text.caption}>{item.company}</Text>
              <Text style={[text.micro, { marginTop: spacing.xs }]}>
                {longDate(item.startedAt)} — {item.endedAt ? longDate(item.endedAt) : 'Present'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },
});
