import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createNotificationSchema } from '@workflex/shared';
import {
  createNotification,
  deleteNotification,
  fetchNotifications,
} from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Button, Card } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

const AUDIENCES = ['ALL', 'WORKERS', 'EMPLOYERS'] as const;

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: fetchNotifications,
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] =
    useState<(typeof AUDIENCES)[number]>('ALL');
  const [error, setError] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: async () => {
      const parsed = createNotificationSchema.safeParse({
        title,
        body,
        audience,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Check the fields');
      }
      return createNotification(parsed.data);
    },
    onSuccess: () => {
      setTitle('');
      setBody('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err) =>
      setError(
        err instanceof Error && !('code' in err) ? err.message : errorText(err),
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
    onError: (err) => Alert.alert('Could not delete', errorText(err)),
  });

  return (
    <SectionScreen
      title="Notifications"
      subtitle="Announcements to app users"
      query={query}
    >
      {(data) => (
        <>
          <Card>
            <Text style={styles.cardTitle}>New notice</Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (error) setError(null);
              }}
              placeholder="Title"
              placeholderTextColor={colors.textFaint}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={body}
              onChangeText={(v) => {
                setBody(v);
                if (error) setError(null);
              }}
              placeholder="Message"
              placeholderTextColor={colors.textFaint}
              multiline
            />

            <View style={styles.chipRow}>
              {AUDIENCES.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => setAudience(a)}
                  style={[styles.chip, audience === a && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      audience === a && styles.chipTextActive,
                    ]}
                  >
                    {a === 'ALL' ? 'Everyone' : a === 'WORKERS' ? 'Workers' : 'Employers'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.publish}>
              <Button
                label="Publish"
                onPress={() => publish.mutate()}
                loading={publish.isPending}
                disabled={!title.trim() || !body.trim()}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.note}>
              Recorded and readable by the app. There is no push delivery yet,
              so this is an announcement log rather than a guaranteed alert.
            </Text>
          </Card>

          <Text style={styles.sectionTitle}>Published</Text>
          {data.length === 0 ? (
            <Card>
              <Text style={styles.muted}>Nothing published yet.</Text>
            </Card>
          ) : (
            data.map((n) => (
              <Card key={n.id}>
                <View style={styles.head}>
                  <Text style={styles.noticeTitle}>{n.title}</Text>
                  <Badge
                    text={n.audience === 'ALL' ? 'Everyone' : n.audience}
                    tone="info"
                  />
                </View>
                <Text style={styles.noticeBody}>{n.body}</Text>
                <View style={styles.footerRow}>
                  <Text style={styles.meta}>
                    {new Date(n.createdAt).toLocaleString()}
                  </Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete notice', `Remove "${n.title}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => remove.mutate(n.id),
                        },
                      ])
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
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
  cardTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.md,
  },
  sectionTitle: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginTop: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    marginBottom: space.sm,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  publish: { marginTop: space.md },
  error: { color: colors.danger, fontSize: font.xs, marginTop: space.sm },
  note: {
    fontSize: font.xs,
    color: colors.textFaint,
    lineHeight: 17,
    marginTop: space.md,
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  noticeTitle: { flex: 1, fontSize: font.sm, fontWeight: '800', color: colors.text },
  noticeBody: {
    fontSize: font.sm,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: space.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
  },
  meta: { fontSize: font.xs, color: colors.textFaint },
  delete: { fontSize: font.xs, fontWeight: '800', color: colors.danger },
  muted: { color: colors.textMuted, fontSize: font.sm },
});
