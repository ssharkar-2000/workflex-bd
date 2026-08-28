import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserNotification } from '@workflex/shared';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../src/api/notifications';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

export default function NotificationsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  // Both mutations invalidate the badge as well as the list — the count is a
  // separate query, so it would otherwise keep showing the old number.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={[styles.back, { color: c.primary }]}>
            ← {t('notif.back')}
          </Text>
        </Pressable>

        {unread > 0 ? (
          <Pressable
            onPress={() => readAll.mutate()}
            disabled={readAll.isPending}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={[styles.readAll, { color: c.primary }]}>
              {t('notif.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.title, { color: c.text }]}>{t('notif.title')}</Text>

      {error ? (
        <View style={styles.pad}>
          <ErrorBanner message={errorMessage(error)} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={
            items.length === 0 ? styles.emptyWrap : styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={c.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {t('notif.emptyTitle')}
              </Text>
              <Text style={[styles.emptyBody, { color: c.textMuted }]}>
                {t('notif.emptyBody')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <NotificationRow
              item={item}
              index={index}
              onPress={() => {
                if (!item.read) readOne.mutate(item.id);
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({
  item,
  index,
  onPress,
}: {
  item: UserNotification;
  index: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const [locale] = useLocale();

  // Cycled tints, so a list of notices reads as the same pastel mix the
  // dashboard uses rather than a stack of identical cards.
  const tint = c.tints[index % c.tints.length];
  const tintBorder = c.tintBorders[index % c.tintBorders.length];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.row,
        {
          backgroundColor: item.read ? c.surfaceAlt : tint,
          borderColor: item.read ? c.border : tintBorder,
        },
      ]}
    >
      <View style={styles.rowTop}>
        {/* An unread dot as well as the fill: colour alone should not be the
            only thing separating read from unread. */}
        {!item.read ? (
          <View style={[styles.dot, { backgroundColor: c.danger }]} />
        ) : null}
        <Text
          style={[
            styles.rowTitle,
            { color: c.text, fontWeight: item.read ? '600' : '800' },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </View>

      <Text style={[styles.rowBody, { color: c.textMuted }]}>{item.body}</Text>

      <Text style={[styles.rowDate, { color: c.textMuted }]}>
        {new Date(item.sentAt).toLocaleDateString(
          locale === 'bn' ? 'bn-BD' : 'en-GB',
          { day: 'numeric', month: 'short', year: 'numeric' },
        )}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: space.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  back: { fontSize: font.sm, fontWeight: '700' },
  readAll: { fontSize: font.sm, fontWeight: '700' },

  title: {
    fontSize: font.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },

  list: { paddingHorizontal: space.md, paddingBottom: space.lg, gap: 10 },

  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  rowTitle: { flex: 1, fontSize: font.md },
  rowBody: { fontSize: font.sm, lineHeight: 20, marginTop: 6 },
  rowDate: { fontSize: font.xs, marginTop: 8 },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: space.lg },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: font.lg, fontWeight: '800' },
  emptyBody: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
});
