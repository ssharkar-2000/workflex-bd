import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUserFilter, AdminUserRow } from '@workflex/shared';
import { fetchUsers, setUserStatus } from '../../src/api/admin';
import { errorText } from '../../src/lib/error-message';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
} from '../../src/components/ui';
import { colors, font, radius, shadow, space } from '../../src/lib/theme';

const FILTERS: { key: AdminUserFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

export default function WorkersScreen() {
  const [filter, setFilter] = useState<AdminUserFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-users', filter, search],
    queryFn: () =>
      fetchUsers({
        filter,
        search: search.trim() || undefined,
        accountType: 'INDIVIDUAL',
      }),
  });

  return (
    <Screen
      title="Workers"
      subtitle={data ? `${data.total} accounts` : undefined}
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
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
          ListEmptyComponent={
            <EmptyState text="No accounts match this filter." />
          }
          renderItem={({ item }) => <UserCard user={item} />}
        />
      )}
    </Screen>
  );
}

function UserCard({ user }: { user: AdminUserRow }) {
  const queryClient = useQueryClient();
  const suspended = user.status === 'SUSPENDED';

  const change = useMutation({
    mutationFn: (next: 'ACTIVE' | 'SUSPENDED') =>
      setUserStatus(
        user.id,
        next,
        next === 'SUSPENDED' ? 'Suspended from the admin portal' : undefined,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => Alert.alert('Could not update', errorText(err)),
  });

  const confirm = () => {
    if (!suspended) {
      // Suspending signs the person out everywhere, so it asks first.
      Alert.alert(
        'Suspend account',
        `${user.name} will be signed out of every device and blocked from signing in. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Suspend',
            style: 'destructive',
            onPress: () => change.mutate('SUSPENDED'),
          },
        ],
      );
    } else {
      change.mutate('ACTIVE');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.meta}>{user.phone}</Text>
        </View>
        <Badge
          text={suspended ? 'Suspended' : `Level ${user.verificationLevel}`}
          tone={
            suspended
              ? 'danger'
              : user.verificationLevel >= 1
                ? 'success'
                : 'neutral'
          }
        />
      </View>

      <View style={styles.tagRow}>
        <Badge
          text={user.kycStatus.replace('_', ' ')}
          tone={
            user.kycStatus === 'APPROVED'
              ? 'success'
              : user.kycStatus === 'PENDING_REVIEW'
                ? 'warning'
                : user.kycStatus === 'REJECTED'
                  ? 'danger'
                  : 'neutral'
          }
        />
        {user.email ? <Badge text={user.email} tone="info" /> : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={suspended ? 'Reactivate' : 'Suspend'}
          tone={suspended ? 'primary' : 'danger'}
          onPress={confirm}
          loading={change.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: space.md,
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
  filterRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },

  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: font.md },
  cardText: { flex: 1 },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  actions: { marginTop: space.md },
});
