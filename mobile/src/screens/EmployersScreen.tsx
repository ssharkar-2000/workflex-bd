import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Avatar, EmptyState, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';

type Employer = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  verified: boolean;
  company: { id: string; name: string; initials: string } | null;
};

type Filter = 'ALL' | 'VERIFIED' | 'UNVERIFIED';

export function EmployersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');

  const counts = useApi<{ total: number; verified: number; unverified: number }>('/employers/counts');
  const query =
    filter === 'ALL' ? '' : `?verified=${filter === 'VERIFIED' ? 'true' : 'false'}`;
  const { data, loading, error, refetch } = useApi<Page<Employer>>(`/employers${query}`, [filter]);

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Text style={text.screenTitle}>Employer Management</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All', count: counts.data?.total },
            { value: 'VERIFIED', label: 'Verified', count: counts.data?.verified },
            { value: 'UNVERIFIED', label: 'Unverified', count: counts.data?.unverified },
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
          ListEmptyComponent={<EmptyState title="No employers here" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                item.company && navigation.navigate('CompanyDetail', { id: item.company.id })
              }
              style={({ pressed }) => [s.card, shadow.card, pressed && { opacity: 0.9 }]}
            >
              <Avatar
                initials={item.fullName
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
              />
              <View style={s.grow}>
                <View style={s.row}>
                  <Text style={text.cardTitle} numberOfLines={1}>
                    {item.fullName}
                  </Text>
                  <StatusPill
                    value={item.verified ? 'VERIFIED' : 'PENDING'}
                    label={item.verified ? 'Verified' : 'Unverified'}
                  />
                </View>
                <Text style={text.caption} numberOfLines={1}>
                  {item.company?.name ?? 'No company linked'}
                </Text>
                <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={1}>
                  {item.code} · {item.email}
                </Text>
              </View>
            </Pressable>
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  grow: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
