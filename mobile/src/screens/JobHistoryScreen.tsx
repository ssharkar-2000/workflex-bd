import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { JobHistoryEntry, Page } from '../api/types';
import { BackButton, EmptyState, ErrorState, FilterTabs, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { longDate, timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  admin: { id: string; displayName: string };
};

type Tab = 'PLACEMENTS' | 'ACTIVITY';

/// "worker.suspend" -> "Worker suspend"
function readable(action: string): string {
  const label = action.replace(/[._]/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function JobHistoryScreen({ route }: any) {
  const { id, name } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const [tab, setTab] = useState<Tab>('PLACEMENTS');

  const placements = useApi<JobHistoryEntry[]>(`/workers/${id}/job-history`);
  const activity = useApi<Page<AuditEntry>>(
    `/security/audit-log?entityType=Worker&entityId=${id}&limit=50`,
  );

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={text.screenTitle}>{t('history.title')}</Text>
        <Text style={text.caption}>{name}</Text>
        <FilterTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'PLACEMENTS', label: t('jobHistory.placements') },
            { value: 'ACTIVITY', label: t('jobHistory.statusActions') },
          ]}
        />
      </View>

      {tab === 'PLACEMENTS' ? (
        placements.error ? (
          <ErrorState message={placements.error} onRetry={placements.refetch} />
        ) : placements.loading && !placements.data ? (
          <Loading />
        ) : (
          <FlatList
            data={placements.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            onRefresh={placements.refetch}
            refreshing={placements.loading}
            ListEmptyComponent={
              <EmptyState title={t('jobHistory.emptyTitle')} hint={t('jobHistory.emptyHint')} />
            }
            renderItem={({ item }) => (
              <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
                <Text style={text.cardTitle} numberOfLines={2}>
                  {item.role}
                </Text>
                <Text style={text.caption} numberOfLines={1}>
                  {item.company}
                </Text>
                <Text style={[text.micro, { marginTop: spacing.xs }]}>
                  {longDate(item.startedAt)} — {item.endedAt ? longDate(item.endedAt) : t('jobHistory.present')}
                </Text>
              </View>
            )}
          />
        )
      ) : activity.error ? (
        <ErrorState message={activity.error} onRetry={activity.refetch} />
      ) : activity.loading && !activity.data ? (
        <Loading />
      ) : (
        <FlatList
          data={activity.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          onRefresh={activity.refetch}
          refreshing={activity.loading}
          ListEmptyComponent={
            <EmptyState title={t('history.emptyTitle')} hint={t('history.emptyHint')} />
          }
          renderItem={({ item }) => (
            <View style={[s.card, shadow.card, { backgroundColor: categoryTint(categoryPalette, item.id).bg }]}>
              <View style={s.row}>
                <Text style={text.cardTitle} numberOfLines={2}>
                  {readable(item.action)}
                </Text>
                <Text style={text.micro}>{timeAgo(item.createdAt, t)}</Text>
              </View>
              <Text style={text.caption}>{t('history.by', { name: item.admin.displayName })}</Text>
              {item.reason ? (
                <Text style={[text.micro, { marginTop: 2 }]} numberOfLines={3}>
                  {item.reason}
                </Text>
              ) : null}
            </View>
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
    list: { padding: spacing.lg, gap: spacing.md },
    card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  });
}
