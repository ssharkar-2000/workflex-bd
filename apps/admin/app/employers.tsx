import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import {
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
} from '../src/components/ui';
import { colors, font, radius, shadow, space } from '../src/lib/theme';

/** Same directory endpoint as Workers, filtered to company accounts. */
export default function EmployersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-users', 'COMPANY', search],
    queryFn: () =>
      fetchUsers({
        filter: 'ALL',
        accountType: 'COMPANY',
        search: search.trim() || undefined,
      }),
  });

  return (
    <Screen
      title="Employers"
      subtitle={data ? `${data.total} company accounts` : undefined}
      right={
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      }
    >
      <View style={styles.controls}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={errorText(error)} onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={data.rows}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListEmptyComponent={<EmptyState text="No company accounts yet." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Text style={styles.company}>
                    {item.companyName ?? 'Company not named'}
                  </Text>
                  <Text style={styles.meta}>
                    {item.name} · {item.phone}
                  </Text>
                </View>
                <Badge
                  text={
                    item.status === 'SUSPENDED'
                      ? 'Suspended'
                      : `Level ${item.verificationLevel}`
                  }
                  tone={
                    item.status === 'SUSPENDED'
                      ? 'danger'
                      : item.verificationLevel >= 2
                        ? 'success'
                        : 'neutral'
                  }
                />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { color: colors.primary, fontWeight: '800', fontSize: font.sm },
  controls: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  company: { fontSize: font.md, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
});
