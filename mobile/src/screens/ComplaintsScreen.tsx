import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Complaint, Page } from '../api/types';
import { BackButton, ErrorState, FilterTabs, Loading, StatusPill } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type Filter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED';

const BACKLOG_DAYS = 3;
const UNRESOLVED: Complaint['status'][] = ['OPEN', 'IN_PROGRESS', 'ESCALATED'];

function isAged(item: Complaint): boolean {
  if (!UNRESOLVED.includes(item.status)) return false;
  const ageMs = Date.now() - new Date(item.createdAt).getTime();
  return ageMs >= BACKLOG_DAYS * 24 * 60 * 60 * 1000;
}

export function ComplaintsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [filter, setFilter] = useState<Filter>('ALL');

  const query = filter === 'ALL' ? '' : `?status=${filter}`;
  const { data, loading, error, refetch } = useApi<Page<Complaint>>(`/complaints${query}`, [filter]);

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={text.screenTitle}>{t('complaints.title')}</Text>
        <Text style={text.caption}>{t('complaints.subtitle')}</Text>
        <FilterTabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t('common.all') },
            { value: 'OPEN', label: t('complaints.open') },
            { value: 'IN_PROGRESS', label: t('complaints.inProgress') },
            { value: 'ESCALATED', label: t('complaints.escalated') },
            { value: 'RESOLVED', label: t('complaints.resolved') },
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
          renderItem={({ item }) => (
            <Pressable
              style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}
              onPress={() => navigation.navigate('ComplaintDetail', { id: item.id })}
            >
              <View style={s.head}>
                <View style={s.codeRow}>
                  {isAged(item) ? <View style={s.redDot} /> : null}
                  <Text style={s.code}>{item.code}</Text>
                </View>
                <StatusPill value={item.status} />
              </View>
              <Text style={text.cardTitle} numberOfLines={2}>
                {item.subject}
              </Text>
              <Text style={text.body} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={text.micro}>
                {item.reporterName} · {longDate(item.createdAt)}
              </Text>
              {item.resolution ? (
                <Text style={s.resolution} numberOfLines={2}>
                  ✓ {item.resolution}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={[text.caption, s.empty]}>{t('complaints.emptyFilter')}</Text>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg },
    list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
    code: { fontSize: 12, fontWeight: '700', color: colors.textGray },
    resolution: { ...text.caption, color: colors.greenText, fontWeight: '600' },
    empty: { textAlign: 'center', marginTop: spacing.xl },
  });
}
