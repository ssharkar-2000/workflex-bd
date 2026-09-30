import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Message } from '@workflex/shared';
import { blockConversation, fetchThread, sendMessage } from '../../../src/api/messaging';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { MessageTicks, type TickState } from '../../../src/components/chat/MessageTicks';
import {
  markRead,
  sendTyping,
  setActiveConversation,
  threadKey,
  upsertMessage,
  useChatLive,
  useOnline,
  useTyping,
} from '../../../src/lib/chat-socket';
import { useErrorMessage } from '../../../src/lib/error-message';
import { useT, type TranslationKey } from '../../../src/i18n';
import { useTheme } from '../../../src/lib/use-theme';
import { font, radius, space } from '../../../src/lib/theme';
import { SECTION_TINT } from './index';

/** A message typed here that the server has not confirmed yet. */
interface Outgoing {
  clientId: string;
  body: string;
  createdAt: string;
  failed: boolean;
}

/** One bubble, whichever of the two it came from. */
interface Item {
  key: string;
  kind: Message['kind'];
  body: string | null;
  createdAt: string;
  mine: boolean;
  tick: TickState;
  outgoing?: Outgoing;
  /** What the message carries besides text: a meeting invitation names its meeting here. */
  payload?: Message['payload'];
}

/** Sent again after this long without a keystroke, while still typing. */
const TYPING_REPEAT_MS = 3_000;
/** "Stopped typing" after this long without one. */
const TYPING_IDLE_MS = 4_000;

/**
 * One conversation, live.
 *
 * For a job thread the job is pinned to the top: somebody juggling four
 * applications and two shifts cannot tell from "can you come at 3?" which
 * job is being discussed. The actions under it change with the relationship
 * — an applicant can open the job, a hired worker can open the shift — so
 * the thread is part of the work rather than a place to talk about it. A
 * direct message has no job, and shows the other person's WorkFlex id
 * instead.
 *
 * New messages, "typing…", "online" and the second tick on what you sent all
 * arrive over the chat socket (see lib/chat-socket.ts). What you send
 * appears at once with a clock, gets one tick when the server has it and two
 * once they have read it.
 */
export default function ConversationScreen() {
  const t = useT();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [draft, setDraft] = useState('');
  const [outbox, setOutbox] = useState<Outgoing[]>([]);

  const connected = useChatLive((s) => s.connected);

  const thread = useInfiniteQuery({
    queryKey: threadKey(id ?? ''),
    queryFn: ({ pageParam }) => fetchThread(id!, pageParam),
    initialPageParam: undefined as string | undefined,
    // Older pages are fetched from before the oldest message already held.
    getNextPageParam: (page) => (page.hasMore ? page.messages[0]?.createdAt : undefined),
    enabled: Boolean(id),
    // The socket keeps this current. Polling is the fallback for when it
    // cannot connect, and — slowly — for the job updates other parts of the
    // system post into a thread without going through the socket.
    refetchInterval: connected ? 60_000 : 15_000,
  });

  const conversation = thread.data?.pages[0]?.conversation;
  const online = useOnline(conversation?.correspondent.id, conversation?.correspondent.online ?? false);
  const typing = useTyping(id);

  // On screen: incoming messages are read as they land, and the thread is
  // read again whenever you come back to it.
  useFocusEffect(
    useCallback(() => {
      if (!id) return undefined;
      setActiveConversation(id);
      markRead(id);
      return () => setActiveConversation(null);
    }, [id]),
  );

  // --- typing ---

  const typingState = useRef<{ sentAt: number; idle: ReturnType<typeof setTimeout> | null }>({
    sentAt: 0,
    idle: null,
  });

  const stopTyping = useCallback(() => {
    const state = typingState.current;
    if (state.idle) clearTimeout(state.idle);
    state.idle = null;
    if (state.sentAt && id) sendTyping(id, false);
    state.sentAt = 0;
  }, [id]);

  useEffect(() => stopTyping, [stopTyping]);

  const onDraftChange = (text: string) => {
    setDraft(text);
    if (!id) return;
    if (!text.trim()) {
      stopTyping();
      return;
    }
    const state = typingState.current;
    if (Date.now() - state.sentAt > TYPING_REPEAT_MS) {
      sendTyping(id, true);
      state.sentAt = Date.now();
    }
    if (state.idle) clearTimeout(state.idle);
    state.idle = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  // --- sending ---

  const send = useMutation({
    mutationFn: (out: Outgoing) => sendMessage(id!, { body: out.body, clientId: out.clientId }),
    onSuccess: (message, out) => {
      upsertMessage(queryClient, message);
      setOutbox((list) => list.filter((item) => item.clientId !== out.clientId));
      // With the socket up, its echo has already moved this thread to the
      // top of the list.
      if (!useChatLive.getState().connected) {
        void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      }
    },
    onError: (_error, out) =>
      setOutbox((list) =>
        list.map((item) => (item.clientId === out.clientId ? { ...item, failed: true } : item)),
      ),
  });

  const submit = () => {
    const body = draft.trim();
    if (!body || !id) return;
    const out: Outgoing = {
      clientId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      body,
      createdAt: new Date().toISOString(),
      failed: false,
    };
    setOutbox((list) => [...list, out]);
    setDraft('');
    stopTyping();
    send.mutate(out);
  };

  const retry = (out: Outgoing) => {
    setOutbox((list) =>
      list.map((item) => (item.clientId === out.clientId ? { ...item, failed: false } : item)),
    );
    send.mutate({ ...out, failed: false });
  };

  const block = useMutation({
    mutationFn: (on: boolean) => blockConversation(id!, on),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadKey(id!) });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  // --- what the list shows, newest first ---

  const items = useMemo<Item[]>(() => {
    const pages = thread.data?.pages ?? [];
    const seen = new Set<string>();
    const confirmed = new Set<string>();
    const stored: Item[] = [];

    // pages[0] is the newest page; each page runs oldest to newest.
    for (const page of pages) {
      for (let i = page.messages.length - 1; i >= 0; i--) {
        const message = page.messages[i]!;
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        if (message.clientId) confirmed.add(message.clientId);
        stored.push({
          key: message.id,
          kind: message.kind,
          body: message.body,
          createdAt: message.createdAt,
          mine: message.mine,
          tick: message.status,
          payload: message.payload,
        });
      }
    }

    // A bubble whose real copy has already arrived over the socket is shown
    // once, as the real one.
    const pending: Item[] = outbox
      .filter((out) => !confirmed.has(out.clientId))
      .reverse()
      .map((out) => ({
        key: out.clientId,
        kind: 'TEXT',
        body: out.body,
        createdAt: out.createdAt,
        mine: true,
        tick: out.failed ? 'FAILED' : 'PENDING',
        outgoing: out,
      }));

    return [...pending, ...stored];
  }, [thread.data, outbox]);

  const subtitle = [
    typing ? t('messages.typing') : online ? t('messages.online') : null,
    conversation?.job
      ? conversation.job.title +
        (conversation.applicationStatus
          ? ` · ${t(`messages.application.${conversation.applicationStatus}` as TranslationKey)}`
          : '')
      : conversation
        ? `${t('messages.direct')} · ${conversation.correspondent.publicId}`
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const name = conversation
    ? (conversation.correspondent.company ?? conversation.correspondent.name)
    : '';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Who, and about what */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/messages'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={[s.back, { color: c.primary }]}>←</Text>
        </Pressable>

        {conversation ? (
          <View>
            <View style={[s.avatar, { backgroundColor: SECTION_TINT(conversation.section, c) }]}>
              <Text style={[s.avatarText, { color: c.primaryText }]}>
                {name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            {online ? (
              <View style={[s.onlineDot, { backgroundColor: c.success, borderColor: c.bg }]} />
            ) : null}
          </View>
        ) : null}

        <View style={s.headerBody}>
          <Text style={[s.headerName, { color: c.text }]} numberOfLines={1}>
            {name}
            {conversation?.correspondent.verified ? (
              <Text style={{ color: c.success }}> ✓</Text>
            ) : null}
          </Text>
          {subtitle ? (
            <Text
              style={[s.headerSub, { color: typing ? c.primary : c.textMuted }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {conversation ? (
          <Pressable
            onPress={() => block.mutate(!conversation.blocked)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              conversation.blocked ? t('messages.unblock') : t('messages.block')
            }
          >
            <Text style={[s.more, { color: conversation.blocked ? c.danger : c.textMuted }]}>
              {conversation.blocked ? '⊘' : '⋮'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* What a job thread lets you do */}
      {conversation?.job ? (
        <View style={[s.actions, { borderBottomColor: c.border }]}>
          <Action
            label={t('messages.viewJob')}
            onPress={() =>
              router.push({ pathname: '/(app)/job/[id]', params: { id: conversation.job!.id } })
            }
          />
          {conversation.shift ? (
            <Action
              label={t('messages.viewShift')}
              onPress={() =>
                router.push({
                  pathname: '/(app)/shifts/[id]',
                  params: { id: conversation.shift!.id },
                })
              }
            />
          ) : null}
          {conversation.section === 'HIRING' ? (
            <Action
              label={t('messages.viewApplicants')}
              onPress={() =>
                router.push({
                  pathname: '/(app)/applicants/[jobId]',
                  params: { jobId: conversation.job!.id },
                })
              }
            />
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {thread.error ? (
          <View style={s.banner}>
            <ErrorBanner message={errorMessage(thread.error)} tone="onSurface" />
          </View>
        ) : null}

        {thread.isLoading ? (
          <ActivityIndicator color={c.primary} style={s.loading} />
        ) : items.length === 0 ? (
          <View style={s.flex}>
            <Text style={[s.empty, { color: c.textMuted }]}>{t('messages.startHere')}</Text>
          </View>
        ) : (
          // Inverted: the newest message sits at the bottom and the list
          // stays pinned there as new ones arrive, as in any chat.
          <FlatList
            inverted
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={({ item, index }) => (
              <Bubble
                item={item}
                // The first of its day — the next item is the one above it.
                dayChange={!sameDay(item.createdAt, items[index + 1]?.createdAt)}
                onRetry={retry}
              />
            )}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              thread.isFetchingNextPage ? (
                <ActivityIndicator color={c.primary} style={s.older} />
              ) : null
            }
          />
        )}

        {/* Writing */}
        {conversation?.blocked ? (
          <View style={[s.blocked, { borderTopColor: c.border }]}>
            <Text style={[s.blockedText, { color: c.textMuted }]}>
              {conversation.blockedByMe ? t('messages.youBlocked') : t('messages.theyBlocked')}
            </Text>
          </View>
        ) : (
          <View style={[s.composer, { borderTopColor: c.border, backgroundColor: c.bg }]}>
            <TextInput
              value={draft}
              onChangeText={onDraftChange}
              onBlur={stopTyping}
              placeholder={t('messages.write')}
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={4000}
              style={[
                s.input,
                { backgroundColor: c.surface, borderColor: c.border, color: c.text },
              ]}
              accessibilityLabel={t('messages.write')}
            />
            <Pressable
              onPress={submit}
              disabled={!draft.trim() || !conversation}
              accessibilityRole="button"
              accessibilityLabel={t('messages.send')}
              style={({ pressed }) => [
                s.sendButton,
                {
                  backgroundColor: pressed ? c.primaryPressed : c.primary,
                  opacity: draft.trim() ? 1 : 0.4,
                },
              ]}
            >
              <Text style={[s.sendText, { color: c.primaryText }]}>➤</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({
  item,
  dayChange,
  onRetry,
}: {
  item: Item;
  dayChange: boolean;
  onRetry: (out: Outgoing) => void;
}) {
  const t = useT();
  const router = useRouter();
  const { c } = useTheme();
  // A meeting invitation (or an update to one) points at its meeting.
  const meetingId =
    item.kind === 'INTERVIEW' && typeof item.payload?.meetingId === 'string'
      ? item.payload.meetingId
      : null;

  const day = dayChange ? (
    <View style={s.dayRow}>
      <Text style={[s.day, { color: c.textMuted, backgroundColor: c.surface, borderColor: c.border }]}>
        {dayLabel(item.createdAt, t)}
      </Text>
    </View>
  ) : null;

  if (item.kind === 'SYSTEM') {
    // "X can no longer do the job" comes with a way to choose somebody else —
    // for the person it was written to, not for the worker who wrote it.
    const replacement = replacementTarget(item.payload);
    return (
      <View>
        {day}
        <Text style={[s.system, { color: c.textMuted }]}>{item.body}</Text>
        {replacement && !item.mine ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/cover/job/[jobId]',
                params: { jobId: replacement.jobId, workerId: replacement.workerId },
              })
            }
            accessibilityRole="button"
            testID="btn-open-matcher-message"
            style={[s.systemLink, { borderColor: c.primary }]}
          >
            <Text style={[s.actionText, { color: c.primary }]}>{t('cover.findReplacement')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // The bubble's own text colour, faded: light on the filled bubble in
  // either theme, since primaryText is what the palette pairs with primary.
  const metaColor = item.mine ? c.primaryText : c.textMuted;
  const failed = item.tick === 'FAILED';

  const bubbleStyle = [
    s.bubble,
    item.mine
      ? { alignSelf: 'flex-end' as const, backgroundColor: c.primary }
      : {
          alignSelf: 'flex-start' as const,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },
    failed && { opacity: 0.7 },
  ];
  const content = (
    <>
      <Text style={[s.bubbleText, { color: item.mine ? c.primaryText : c.text }]}>
        {item.body}
      </Text>
      {meetingId ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/(app)/meetings/[id]', params: { id: meetingId } })
          }
          accessibilityRole="button"
          testID="btn-open-meeting"
          style={[s.meetingLink, { borderColor: item.mine ? c.primaryText : c.primary }]}
        >
          <Text style={[s.actionText, { color: item.mine ? c.primaryText : c.primary }]}>
            {t('meetings.openMeeting')}
          </Text>
        </Pressable>
      ) : null}
      <View style={s.meta}>
        <Text style={[s.bubbleTime, { color: metaColor }]}>
          {new Date(item.createdAt).toLocaleTimeString('en-GB', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </Text>
        {item.mine ? (
          <View style={s.tick}>
            <MessageTicks
              state={item.tick}
              color={metaColor}
              label={t(TICK_LABEL[item.tick])}
            />
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View>
      {day}
      {failed ? (
        <Pressable
          onPress={() => item.outgoing && onRetry(item.outgoing)}
          accessibilityRole="button"
          accessibilityHint={t('messages.failed')}
          style={bubbleStyle}
        >
          {content}
        </Pressable>
      ) : (
        <View style={bubbleStyle}>{content}</View>
      )}
      {failed ? (
        <Text style={[s.failed, { color: c.danger }]}>{t('messages.failed')}</Text>
      ) : null}
    </View>
  );
}

const TICK_LABEL: Record<TickState, TranslationKey> = {
  PENDING: 'messages.sending',
  FAILED: 'messages.failed',
  SENT: 'messages.sent',
  SEEN: 'messages.seen',
};

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.action,
        {
          borderColor: c.primarySoftBorder,
          backgroundColor: pressed ? c.primarySoft : 'transparent',
        },
      ]}
    >
      <Text style={[s.actionText, { color: c.primary }]}>{label}</Text>
    </Pressable>
  );
}

/** Where a "replace this worker" message points, when it says. */
function replacementTarget(
  payload: Message['payload'] | undefined,
): { jobId: string; workerId: string } | null {
  const target = payload?.replacement as { jobId?: unknown; workerId?: unknown } | undefined;
  return typeof target?.jobId === 'string' && typeof target?.workerId === 'string'
    ? { jobId: target.jobId, workerId: target.workerId }
    : null;
}

function sameDay(a: string, b: string | undefined): boolean {
  if (!b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** "Today", "Yesterday", then "20 September 2026". */
function dayLabel(iso: string, t: (key: TranslationKey) => string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return t('messages.today');
  if (date.toDateString() === yesterday.toDateString()) return t('messages.yesterday');
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
  back: { fontSize: font.xl, fontWeight: '800' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.md, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerBody: { flex: 1 },
  headerName: { fontSize: font.md, fontWeight: '800' },
  headerSub: { fontSize: font.xs },
  more: { fontSize: font.lg, fontWeight: '800' },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
  },
  action: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  actionText: { fontSize: font.xs, fontWeight: '800' },

  banner: { paddingHorizontal: space.md, paddingTop: space.sm },
  scroll: { padding: space.md, gap: space.sm },
  loading: { marginTop: space.lg },
  older: { marginVertical: space.sm },
  empty: { fontSize: font.sm, lineHeight: 20, textAlign: 'center', marginTop: space.xl },

  dayRow: { alignItems: 'center', marginVertical: space.sm },
  day: {
    fontSize: font.xs,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    overflow: 'hidden',
  },

  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 8 },
  bubbleText: { fontSize: font.sm, lineHeight: 20 },
  meetingLink: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    marginTop: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  bubbleTime: { fontSize: 10, opacity: 0.75 },
  tick: { opacity: 0.85 },
  failed: { fontSize: font.xs, alignSelf: 'flex-end', marginTop: 2 },
  system: { fontSize: font.xs, textAlign: 'center', paddingVertical: space.sm },
  systemLink: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    marginBottom: space.sm,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: font.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: font.md, fontWeight: '800' },

  blocked: { padding: space.md, borderTopWidth: 1, alignItems: 'center' },
  blockedText: { fontSize: font.sm, textAlign: 'center' },
});
