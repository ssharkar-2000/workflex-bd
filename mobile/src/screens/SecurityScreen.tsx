import React, { useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { EmptyState, ErrorState, FilterTabs, Loading } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';
import { timeAgo } from '../theme/format';

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
  admin: { id: string; displayName: string; email: string };
};

type Session = {
  id: string;
  admin: { id: string; displayName: string; email: string };
  createdAt: string;
  expiresAt: string;
};

type Tab = 'AUDIT' | 'SESSIONS';

/// "worker.suspend" -> "Worker suspend"
function readable(action: string): string {
  const label = action.replace(/[._]/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('AUDIT');

  const overview = useApi<{
    activeSessions: number;
    actionsToday: number;
    admins: number;
    openAlerts: number;
  }>('/security/overview');
  const audit = useApi<Page<AuditEntry>>('/security/audit-log');
  const sessions = useApi<Session[]>('/security/sessions');

  const revoke = async (id: string) => {
    try {
      await api(`/security/sessions/${id}/revoke`, { method: 'POST' });
      await Promise.all([sessions.refetch(), overview.refetch()]);
    } catch (e: any) {
      RNAlert.alert('Could not revoke', e.message);
    }
  };

  const header = (
    <View>
      <Text style={text.screenTitle}>Security</Text>

      {overview.data ? (
        <View style={s.grid}>
          <Tile value={overview.data.activeSessions} label="Active sessions" />
          <Tile value={overview.data.actionsToday} label="Actions (24h)" />
          <Tile value={overview.data.admins} label="Admins" />
          <Tile value={overview.data.openAlerts} label="Open alerts" />
        </View>
      ) : null}

      <FilterTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'AUDIT', label: 'Audit log' },
          { value: 'SESSIONS', label: 'Sessions' },
        ]}
      />
    </View>
  );

  if (tab === 'SESSIONS') {
    return (
      <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
        <FlatList
          data={sessions.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={header}
          onRefresh={sessions.refetch}
          refreshing={sessions.loading}
          ListEmptyComponent={
            sessions.error ? (
              <ErrorState message={sessions.error} onRetry={sessions.refetch} />
            ) : sessions.loading ? (
              <Loading />
            ) : (
              <EmptyState title="No active sessions" />
            )
          }
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card]}>
              <View style={s.grow}>
                <Text style={text.cardTitle}>{item.admin.displayName}</Text>
                <Text style={text.caption}>{item.admin.email}</Text>
                <Text style={[text.micro, { marginTop: 2 }]}>
                  Started {timeAgo(item.createdAt)}
                </Text>
              </View>
              <Pressable onPress={() => revoke(item.id)} hitSlop={8}>
                <Text style={s.revoke}>Revoke</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={audit.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={header}
        onRefresh={audit.refetch}
        refreshing={audit.loading}
        ListEmptyComponent={
          audit.error ? (
            <ErrorState message={audit.error} onRetry={audit.refetch} />
          ) : audit.loading ? (
            <Loading />
          ) : (
            <EmptyState title="Nothing logged yet" hint="Admin actions appear here as they happen." />
          )
        }
        renderItem={({ item }) => (
          <View style={[s.card, shadow.card]}>
            <View style={s.grow}>
              <View style={s.row}>
                <Text style={text.cardTitle}>{readable(item.action)}</Text>
                <Text style={text.micro}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={text.caption}>
                {item.admin.displayName} · {item.entityType}
              </Text>
              {item.reason ? (
                <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={2}>
                  {item.reason}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <View style={[s.tile, shadow.card]}>
      <Text style={text.stat}>{value}</Text>
      <Text style={[text.caption, { marginTop: 2 }]}>{label}</Text>
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
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  grow: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  revoke: { ...text.label, color: colors.redText },
});
