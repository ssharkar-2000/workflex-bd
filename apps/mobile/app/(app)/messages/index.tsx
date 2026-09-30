import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Conversation, Inbox, InboxFilter } from '@workflex/shared';
import { fetchInbox } from '../../../src/api/messaging';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MessageTicks } from '../../../src/components/chat/MessageTicks';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useChatLive, useOnline, useTyping } from '../../../src/lib/chat-socket';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';

const FILTERS: InboxFilter[] = ['ALL', 'DIRECT', 'APPLICATION', 'HIRING', 'WORK'];

/**
 * Every conversation this account is part of.
 *
 * The sections are the same threads seen from different angles rather than
 * separate mailboxes: a person who both works and hires has applications in
 * one hand and applicants in the other, and splitting the inbox by role
 * would mean checking two places for the same day's work.
 *
 * Direct messages sit alongside, started from "New chat" with someone's
 * WorkFlex id. The chat socket keeps the list live — new messages move a
 * thread to the top, and ticks, dots and "typing…" update as they happen.
 */
export default function MessagesScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();
  const connected = useChatLive((s) => s.connected);

  const [filter, setFilter] = useState<InboxFilter>('ALL');
  const [search, setSearch] = useState('');

  const inbox = useQuery<Inbox>({
    queryKey: ['inbox', filter, search],
    queryFn: () => fetchInbox(filter, search.trim() || undefined),
    // New messages should appear without the person pulling to refresh. The
    // socket does that while it is connected; polling is the fallback, and
    // still picks up the job updates other parts of the system post.
    refetchInterval: connected ? 60_000 : 30_000,
  });

  const counts = inbox.data?.counts;

  return (
    <MoneyScreen
      title={t('messages.title')}
      refreshing={inbox.isRefetching}
      onRefresh={() => void inbox.refetch()}
    >
      <View style={s.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('messages.search')}
          placeholderTextColor={c.textMuted}
          style={[
            s.search,
            { backgroundColor: c.surface, borderColor: c.border, color: c.text },
          ]}
          accessibilityLabel={t('messages.search')}
        />
        <Pressable
          onPress={() => router.push('/(app)/messages/new')}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.newChat,
            { backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
        >
          <Text style={[s.newChatText, { color: c.primaryText }]}>+ {t('messages.newChat')}</Text>
        </Pressable>
      </View>

      <View style={s.filters}>
        {FILTERS.map((option) => {
          const count =
            option === 'ALL'
              ? counts?.all
              : option === 'DIRECT'
                ? counts?.direct
                : option === 'APPLICATION'
                  ? counts?.application
                  : option === 'HIRING'
                    ? counts?.hiring
                    : counts?.work;

          return (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option }}
              style={[
                s.filter,
                {
                  backgroundColor: filter === option ? c.primarySoft : 'transparent',
                  borderColor: filter === option ? c.primarySoftBorder : c.border,
                },
              ]}
            >
              <Text
                style={[s.filterText, { color: filter === option ? c.primary : c.textMuted }]}
              >
                {t(`messages.filter.${option}` as TranslationKey)}
                {count ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {inbox.error ? <ErrorBanner message={errorMessage(inbox.error)} tone="onSurface" /> : null}

      {inbox.isLoading ? (
        <ActivityIndicator color={c.primary} style={s.loading} />
      ) : (inbox.data?.conversations.length ?? 0) === 0 ? (
        <Text style={[s.empty, { color: c.textMuted }]}>{t('messages.empty')}</Text>
      ) : (
        <View style={[s.list, { backgroundColor: c.surface, borderColor: c.border }]}>
          {inbox.data!.conversations.map((row, i) => (
            <Row key={row.id} row={row} first={i === 0} />
          ))}
        </View>
      )}
    </MoneyScreen>
  );
}

function Row({ row, first }: { row: Conversation; first: boolean }) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();

  const name = row.correspondent.company ?? row.correspondent.name;
  const initials = name.slice(0, 1).toUpperCase();
  const online = useOnline(row.correspondent.id, row.correspondent.online);
  const typing = useTyping(row.id);
  const last = row.lastMessage;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/(app)/messages/[id]', params: { id: row.id } })
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        s.row,
        !first && { borderTopWidth: 1, borderTopColor: c.border },
        pressed && { backgroundColor: c.surfaceAlt },
      ]}
    >
      <View>
        <View style={[s.avatar, { backgroundColor: SECTION_TINT(row.section, c) }]}>
          <Text style={[s.avatarText, { color: c.primaryText }]}>{initials}</Text>
        </View>
        {online ? (
          <View style={[s.onlineDot, { backgroundColor: c.success, borderColor: c.surface }]} />
        ) : null}
      </View>

      <View style={s.body}>
        <View style={s.topLine}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
            {name}
            {row.correspondent.verified ? (
              <Text style={{ color: c.success }}> ✓</Text>
            ) : null}
          </Text>
          <Text style={[s.when, { color: c.textMuted }]}>{ago(row.lastMessageAt, t)}</Text>
        </View>

        <Text style={[s.job, { color: c.textMuted }]} numberOfLines={1}>
          {row.job ? row.job.title : `${t('messages.direct')} · ${row.correspondent.publicId}`}
        </Text>

        <View style={s.bottomLine}>
          {!typing && !row.blocked && last?.mine ? (
            <MessageTicks
              state={last.status}
              color={c.textMuted}
              label={last.status === 'SEEN' ? t('messages.seen') : t('messages.sent')}
            />
          ) : null}
          <Text
            style={[s.preview, { color: typing ? c.primary : c.text }]}
            numberOfLines={1}
          >
            {typing
              ? t('messages.typing')
              : row.blocked
                ? t('messages.blocked')
                : (last?.body ?? t('messages.noMessages'))}
          </Text>
          {row.unread > 0 ? (
            <View style={[s.badge, { backgroundColor: c.primary }]}>
              <Text style={[s.badgeText, { color: c.primaryText }]}>{row.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** One tint per section, so the inbox is scannable without reading. */
export function SECTION_TINT(
  section: Conversation['section'],
  c: { primary: string; accent: string; ai: string },
): string {
  switch (section) {
    case 'APPLICATION':
      return c.primary;
    case 'HIRING':
      return c.accent;
    case 'DIRECT':
      return c.primary;
    default:
      return c.ai;
  }
}

/** "10 min ago", "3 hrs ago", "Yesterday", then a date. */
export function ago(
  iso: string,
  t: (key: TranslationKey, vars?: Record<string, string>) => string,
): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return t('messages.now');
  if (minutes < 60) return t('messages.minutesAgo', { count: String(minutes) });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('messages.hoursAgo', { count: String(hours) });
  if (hours < 48) return t('messages.yesterday');

  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const s = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  search: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: font.sm,
  },
  newChat: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  newChatText: { fontSize: font.xs, fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  filter: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  filterText: { fontSize: font.xs, fontWeight: '800' },

  loading: { marginTop: space.lg },
  empty: { fontSize: font.sm, lineHeight: 20, marginTop: space.lg },

  list: { borderWidth: 1, borderRadius: radius.lg, marginTop: space.md, paddingHorizontal: space.md },
  row: { flexDirection: 'row', gap: space.sm, paddingVertical: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.md, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  body: { flex: 1, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: font.sm + 1, fontWeight: '800' },
  when: { fontSize: font.xs },
  job: { fontSize: font.xs },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  preview: { flex: 1, fontSize: font.sm },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: font.xs, fontWeight: '800' },
});
