import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useApi } from '../api/hooks';
import { Notification } from '../api/types';
import { BackButton, ErrorState, Loading } from '../components';
import { useI18n } from '../i18n/I18nContext';
import { buildText, categoryTint, radii, spacing, ThemeColors } from '../theme';
import { timeAgo } from '../theme/format';
import { useTheme } from '../theme/ThemeContext';

const ICON: Record<Notification['kind'], string> = {
  SOS: '🚨',
  VERIFICATION: '📋',
  PAYMENT: '💳',
  FRAUD: '🛡️',
  JOB: '💼',
};

export function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, text, shadow, categoryPalette } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors, text), [colors, text]);
  const { data, loading, error, refetch } = useApi<{ items: Notification[]; unread: number }>(
    '/notifications',
  );

  const markAllRead = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    await refetch();
  };

  return (
    <View style={[s.flex, { paddingTop: insets.top + spacing.sm }]}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <View style={s.head}>
            <View>
              <BackButton onPress={() => navigation.goBack()} />
              <Text style={text.screenTitle}>{t('notifications.title')}</Text>
              <Text style={text.caption}>{t('notifications.unreadCount', { count: data?.unread ?? 0 })}</Text>
            </View>
            {(data?.unread ?? 0) > 0 ? (
              <Pressable onPress={markAllRead} hitSlop={8}>
                <Text style={s.markAll}>{t('notifications.markAllRead')}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          error ? <ErrorState message={error} onRetry={refetch} /> : loading ? <Loading /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={async () => {
              if (!item.read) {
                await api(`/notifications/${item.id}/read`, { method: 'POST' });
                await refetch();
              }
            }}
            style={({ pressed }) => [
              s.card,
              shadow.card,
              { backgroundColor: categoryTint(categoryPalette, item.id).bg },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View
              style={[s.iconBubble, { backgroundColor: categoryTint(categoryPalette, item.kind).bg }]}
            >
              <Text style={s.icon}>{ICON[item.kind]}</Text>
            </View>
            <View style={s.grow}>
              <View style={s.titleRow}>
                <Text style={[text.cardTitle, !item.read && s.unreadTitle]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={text.micro}>{timeAgo(item.createdAt, t)}</Text>
              </View>
              {item.body ? (
                <Text style={[text.caption, { marginTop: 2 }]} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
            </View>
            {!item.read ? <View style={s.dot} /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors, text: ReturnType<typeof buildText>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.lg, gap: spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    markAll: { ...text.caption, color: colors.primary, fontWeight: '700' },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    icon: { fontSize: 20 },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grow: { flex: 1 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    unreadTitle: { fontWeight: '700' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  });
}
