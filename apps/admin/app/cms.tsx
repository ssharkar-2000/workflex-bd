import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { upsertContentSchema } from '@workflex/shared';
import { deleteContent, fetchContent, upsertContent } from '../src/api/admin';
import { errorText } from '../src/lib/error-message';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Button, Card } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

/**
 * Copy the worker app reads by key — terms, help text, banners. Editing here
 * means changing wording without shipping an app build.
 */
export default function CmsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin-cms'], queryFn: fetchContent });

  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [locale, setLocale] = useState<'bn' | 'en'>('bn');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = upsertContentSchema.safeParse({ key, title, body, locale });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Check the fields');
      }
      return upsertContent(parsed.data);
    },
    onSuccess: () => {
      setKey('');
      setTitle('');
      setBody('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-cms'] });
    },
    onError: (err) =>
      setError(
        err instanceof Error && !('code' in err) ? err.message : errorText(err),
      ),
  });

  const remove = useMutation({
    mutationFn: (k: string) => deleteContent(k),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-cms'] }),
    onError: (err) => Alert.alert('Could not delete', errorText(err)),
  });

  return (
    <SectionScreen title="CMS" subtitle="App copy blocks" query={query}>
      {(data) => (
        <>
          <Card>
            <Text style={styles.cardTitle}>
              {data.some((c) => c.key === key) ? 'Update block' : 'New block'}
            </Text>
            <Text style={styles.hint}>
              The key is how the app looks this up — reuse an existing key to
              edit it, or invent one for new copy.
            </Text>

            <TextInput
              style={styles.input}
              value={key}
              onChangeText={(v) => {
                setKey(v.toLowerCase());
                if (error) setError(null);
              }}
              placeholder="terms.worker"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.textFaint}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={body}
              onChangeText={setBody}
              placeholder="Body text"
              placeholderTextColor={colors.textFaint}
              multiline
            />

            <View style={styles.chipRow}>
              {(['bn', 'en'] as const).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLocale(l)}
                  style={[styles.chip, locale === l && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      locale === l && styles.chipTextActive,
                    ]}
                  >
                    {l === 'bn' ? 'বাংলা' : 'English'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.saveWrap}>
              <Button
                label="Save block"
                onPress={() => save.mutate()}
                loading={save.isPending}
                disabled={!key.trim() || !title.trim() || !body.trim()}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>

          <Text style={styles.sectionTitle}>Blocks</Text>
          {data.length === 0 ? (
            <Card>
              <Text style={styles.muted}>No copy blocks yet.</Text>
            </Card>
          ) : (
            data.map((c) => (
              <Card key={c.id}>
                <View style={styles.head}>
                  <Text style={styles.blockKey}>{c.key}</Text>
                  <Badge text={c.locale} tone="info" />
                </View>
                <Text style={styles.blockTitle}>{c.title}</Text>
                <Text style={styles.blockBody} numberOfLines={4}>
                  {c.body}
                </Text>
                <View style={styles.footerRow}>
                  <Pressable
                    onPress={() => {
                      setKey(c.key);
                      setTitle(c.title);
                      setBody(c.body);
                      setLocale(c.locale === 'en' ? 'en' : 'bn');
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.edit}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete block', `Remove "${c.key}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => remove.mutate(c.key),
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
  cardTitle: { fontSize: font.md, fontWeight: '800', color: colors.text },
  hint: {
    fontSize: font.xs,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  saveWrap: { marginTop: space.md },
  error: { color: colors.danger, fontSize: font.xs, marginTop: space.sm },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  blockKey: {
    flex: 1,
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  blockTitle: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.text,
    marginTop: space.sm,
  },
  blockBody: {
    fontSize: font.xs,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
  footerRow: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  edit: { fontSize: font.xs, fontWeight: '800', color: colors.primary },
  delete: { fontSize: font.xs, fontWeight: '800', color: colors.danger },
  muted: { color: colors.textMuted, fontSize: font.sm },
});
