import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSecurity, revokeSessions } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Button, Card, StatTile } from '../src/components/ui';
import { colors, font, space } from '../src/lib/theme';

export default function SecurityScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-security'],
    queryFn: fetchSecurity,
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeSessions(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-security'] });
    },
    onError: (err) => Alert.alert('Could not revoke', errorText(err)),
  });

  const confirmRevoke = (userId: string, name: string) => {
    Alert.alert(
      'Sign out everywhere',
      `${name} will be signed out of every device immediately. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => revoke.mutate(userId),
        },
      ],
    );
  };

  return (
    <SectionScreen title="Security" subtitle="Sessions and staff" query={query}>
      {(data) => (
        <>
          <View style={styles.grid}>
            <StatTile
              label="Active sessions"
              value={String(data.activeSessions)}
            />
            <StatTile
              label="Suspended"
              value={String(data.suspendedAccounts)}
              tone={data.suspendedAccounts > 0 ? 'warning' : 'default'}
            />
            <StatTile label="Admin accounts" value={String(data.adminAccounts)} />
          </View>

          <Text style={styles.sectionTitle}>Staff accounts</Text>
          <Card>
            {data.admins.map((a, i) => (
              <View key={a.id} style={[styles.row, i > 0 && styles.divided]}>
                <View style={styles.grow}>
                  <Text style={styles.name}>{a.name ?? a.email}</Text>
                  <Text style={styles.meta}>{a.email}</Text>
                </View>
                <Text style={styles.lastSeen}>
                  {a.lastLoginAt
                    ? new Date(a.lastLoginAt).toLocaleDateString()
                    : 'never'}
                </Text>
              </View>
            ))}
          </Card>

          <Text style={styles.sectionTitle}>Active user sessions</Text>
          {data.recentSessions.length === 0 ? (
            <Card>
              <Text style={styles.muted}>No live sessions.</Text>
            </Card>
          ) : (
            data.recentSessions.map((s) => (
              <Card key={s.id}>
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{s.userName}</Text>
                    <Text style={styles.meta}>
                      {s.userPhone}
                      {s.ip ? ` · ${s.ip}` : ''}
                    </Text>
                    <Text style={styles.meta}>
                      Started {new Date(s.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <Badge text="Live" tone="success" />
                </View>
                <View style={styles.action}>
                  <Button
                    label="Sign out everywhere"
                    tone="outline"
                    onPress={() => confirmRevoke(s.userId, s.userName)}
                    loading={revoke.isPending}
                  />
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </SectionScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginTop: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  divided: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: space.md,
    marginTop: space.md,
  },
  grow: { flex: 1 },
  name: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  lastSeen: { fontSize: font.xs, color: colors.textFaint },
  action: { marginTop: space.md },
  muted: { color: colors.textMuted, fontSize: font.sm },
});
