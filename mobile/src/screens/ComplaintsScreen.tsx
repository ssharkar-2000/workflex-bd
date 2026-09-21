import React, { useState } from 'react';
import { Alert as RNAlert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Button, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { longDate } from '../theme/format';

type Complaint = {
  id: string;
  code: string;
  subject: string;
  body: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  reporterName: string;
  resolution: string | null;
  createdAt: string;
};

type Filter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export function ComplaintsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = filter === 'ALL' ? '' : `?status=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<Complaint>>(`/complaints${query}`, [filter]);

  const advance = async (complaint: Complaint) => {
    const next = complaint.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED';
    setBusyId(complaint.id);
    try {
      await api(`/complaints/${complaint.id}`, {
        method: 'PATCH',
        body: {
          status: next,
          ...(next === 'RESOLVED' ? { resolution: 'Resolved by support team' } : {}),
        },
      });
      await refetch();
    } catch (e: any) {
      RNAlert.alert('Action failed', e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Text style={text.screenTitle}>Complaints & Support</Text>
        <Text style={text.caption}>Manage all support tickets and queries.</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'OPEN', label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'RESOLVED', label: 'Resolved' },
          ]}
        />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          onRefresh={refetch}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card]}>
              <View style={s.head}>
                <Text style={s.code}>{item.code}</Text>
                <StatusPill value={item.status} />
              </View>
              <Text style={text.cardTitle}>{item.subject}</Text>
              <Text style={text.body} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={text.micro}>
                {item.reporterName} · {longDate(item.createdAt)}
              </Text>
              {item.status === 'OPEN' || item.status === 'IN_PROGRESS' ? (
                <Button
                  label={item.status === 'OPEN' ? 'Start working' : 'Mark resolved'}
                  variant={item.status === 'OPEN' ? 'primary' : 'success'}
                  loading={busyId === item.id}
                  onPress={() => advance(item)}
                />
              ) : item.resolution ? (
                <Text style={s.resolution}>✓ {item.resolution}</Text>
              ) : null}
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
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 12, fontWeight: '700', color: colors.textGray },
  resolution: { ...text.caption, color: colors.greenText, fontWeight: '600' },
});
