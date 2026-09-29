import React, { useMemo, useState } from 'react';
import { Alert as RNAlert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { friendlyError } from '../api/errors';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { BackButton, EmptyState, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

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

/**
 * Soft, low-contrast tint per CMS kind so the three types are easy to tell
 * apart at a glance in the list — but stay gentle against the card/background
 * instead of shouting. Built from the theme's existing "soft" tokens (already
 * tuned to sit quietly on both the light and dark background) rather than new
 * hardcoded hex values, so it keeps working correctly in dark mode too.
 */
function kindTint(colors: ThemeColors, kind: CmsBlock['kind']) {
  return {
    BANNER: { bg: colors.primarySoft, fg: colors.primary },
    PAGE: { bg: colors.brandSoft, fg: colors.brand },
    FAQ: { bg: colors.amberBg, fg: colors.amberText },
  }[kind];
}

export function CmsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = filter === 'ALL' ? '' : `?kind=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<CmsBlock>>(`/cms${query}`, [filter]);

  const togglePublish = async (block: CmsBlock) => {
    setBusyId(block.id);
    try {
      await api(`/cms/${block.id}`, { method: 'PATCH', body: { published: !block.published } });
      await refetch();
    } catch (e) {
      RNAlert.alert(t('cms.updateFailed'), friendlyError(e, t));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.headRow}>
          <Text style={text.screenTitle}>{t('cms.title')}</Text>
          <Pressable onPress={() => navigation.navigate('CmsDetail', {})} hitSlop={8}>
            <Text style={s.newButton}>{t('cms.new')}</Text>
          </Pressable>
        </View>
        <Text style={text.caption}>{t('cms.subtitle')}</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t('common.all') },
            { value: 'BANNER', label: t('cms.banners') },
            { value: 'PAGE', label: t('cms.pages') },
            { value: 'FAQ', label: t('cms.faqs') },
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
          ListEmptyComponent={<EmptyState title={t('cms.empty')} />}
          renderItem={({ item }) => (
            <Pressable
              style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}
              onPress={() => navigation.navigate('CmsDetail', { id: item.id })}
            >
              <View style={s.row}>
                <Text style={text.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusPill
                  value={item.published ? 'APPROVED' : 'PENDING'}
                  label={item.published ? t('cms.live') : t('cms.draft')}
                />
              </View>
              {item.titleBn ? (
                <Text style={text.caption} numberOfLines={1}>
                  {item.titleBn}
                </Text>
              ) : null}
              {item.body ? (
                <Text style={text.body} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              <View style={s.foot}>
                <View style={s.footLeft}>
                  <View style={[s.kindPill, { backgroundColor: kindTint(colors, item.kind).bg }]}>
                    <Text style={[s.kindPillText, { color: kindTint(colors, item.kind).fg }]}>
                      {item.kind.toLowerCase()}
                    </Text>
                  </View>
                  <Text style={text.micro}>/{item.slug}</Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    togglePublish(item);
                  }}
                  disabled={busyId === item.id}
                  hitSlop={8}
                >
                  <Text style={[s.action, item.published && { color: colors.textGray }]}>
                    {item.published ? t('cms.unpublish') : t('cms.publish')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    newButton: { ...text.label, color: colors.primary },
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
    footLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    kindPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill },
    kindPillText: { fontSize: 11, fontWeight: '700' },
    action: { ...text.label, color: colors.primary },
  });
}
