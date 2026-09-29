import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/hooks';
import { Page } from '../api/types';
import { BackButton, EmptyState, ErrorState, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  admin: { id: string; displayName: string };
};

/// "job.approve" -> "Job approve"
function readable(action: string): string {
  const label = action.replace(/[._]/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/// Generic "View History" destination for any entity — pass entityType,
/// entityId, and a title. Backed by the real audit log, so it always shows
/// exactly what actually happened to that record: who did it and when.
export function EntityHistoryScreen({ route, navigation }: any) {
  const { entityType, entityId, title } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data, loading, error, refetch } = useApi<Page<AuditEntry>>(
    `/security/audit-log?entityType=${entityType}&entityId=${entityId}&limit=50`,
  );

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={text.screenTitle}>{t('history.title')}</Text>
        <Text style={text.caption}>{title}</Text>
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
