import React, { useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { EmptyState, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { colors, radii, shadow, spacing, text } from '../theme';

type CmsBlock = {
  id: string;
  kind: 'BANNER' | 'PAGE' | 'FAQ';
  slug: string;
  title: string;
  titleBn: string | null;
  body: string | null;
  published: boolean;
  position: number;
};

type Filter = 'ALL' | 'BANNER' | 'PAGE' | 'FAQ';

export function CmsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = filter === 'ALL' ? '' : `?kind=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<CmsBlock>>(`/cms${query}`, [filter]);

  const togglePublish = async (block: CmsBlock) => {
    setBusyId(block.id);
    try {
      await api(`/cms/${block.id}`, { method: 'PATCH', body: { published: !block.published } });
      await refetch();
    } catch (e: any) {
      RNAlert.alert('Could not update', e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Text style={text.screenTitle}>CMS</Text>
        <Text style={text.caption}>Banners, pages, and FAQs shown in the worker app.</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'BANNER', label: 'Banners' },
            { value: 'PAGE', label: 'Pages' },
            { value: 'FAQ', label: 'FAQs' },
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
          ListEmptyComponent={<EmptyState title="No content blocks" />}
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card]}>
              <View style={s.row}>
                <Text style={text.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusPill
                  value={item.published ? 'APPROVED' : 'PENDING'}
                  label={item.published ? 'Live' : 'Draft'}
                />
              </View>
              {item.titleBn ? <Text style={text.caption}>{item.titleBn}</Text> : null}
              {item.body ? (
                <Text style={text.body} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              <View style={s.foot}>
                <Text style={text.micro}>
                  {item.kind.toLowerCase()} · /{item.slug}
                </Text>
                <Pressable onPress={() => togglePublish(item)} disabled={busyId === item.id} hitSlop={8}>
                  <Text style={[s.action, item.published && { color: colors.textGray }]}>
                    {item.published ? 'Unpublish' : 'Publish'}
                  </Text>
                </Pressable>
              </View>
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  action: { ...text.label, color: colors.primary },
});
