import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { Avatar, EmptyState, ErrorState, Loading, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';

type Company = {
  id: string;
  name: string;
  initials: string;
  industry: string | null;
  address: string | null;
  verified: boolean;
  _count: { jobs: number; employers: number };
};

export function CompaniesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useApi<Page<Company>>('/companies');

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
            <Text style={text.screenTitle}>Company Management</Text>
            <Text style={[text.caption, { marginTop: spacing.xs }]}>
              {data?.meta.total ?? 0} companies on the platform
            </Text>
          </View>
        }
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <Loading />
          ) : (
            <EmptyState title="No companies yet" />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('CompanyDetail', { id: item.id })}
            style={({ pressed }) => [s.card, shadow.card, pressed && { opacity: 0.9 }]}
          >
            <View style={s.top}>
              <Avatar initials={item.initials} />
              <View style={s.grow}>
                <View style={s.row}>
                  <Text style={text.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.verified ? <StatusPill value="VERIFIED" label="Verified" /> : null}
                </View>
                <Text style={text.caption}>{item.industry ?? 'Industry not set'}</Text>
              </View>
            </View>
            {item.address ? (
              <Text style={text.micro} numberOfLines={1}>
                📍 {item.address}
              </Text>
            ) : null}
            <View style={s.stats}>
              <Text style={s.stat}>{item._count.jobs} jobs</Text>
              <Text style={s.stat}>{item._count.employers} employers</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  grow: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  stat: { ...text.caption, fontWeight: '600', color: colors.primary },
});
