import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import {
  CHAT_SOCKET_NAMESPACE,
  CHAT_SOCKET_PATH,
  type ChatClientEvents,
  type ChatReadEvent,
  type ChatServerEvents,
  type ChatTypingEvent,
  type ConversationThread,
  type Inbox,
  type Message,
} from '@workflex/shared';
import { refreshAccessToken } from '../api/client';
import { markThreadRead } from '../api/messaging';
import { useAuthStore } from '../store/auth-store';
import { env } from './env';

/**
 * The live half of messaging: one Socket.IO connection while signed in.
 *
 * Messages are still sent over HTTP. This carries what arrives unasked — a
 * new message, the other person reading yours, typing, coming online — and
 * writes it straight into React Query's cache, so every screen showing that
 * data updates without fetching anything.
 *
 * Nothing here is the source of truth. A reconnect refetches the inbox and
 * any open thread rather than replaying what was missed, which is simpler
 * and cannot drift from the server.
 */

type ChatSocket = Socket<ChatServerEvents, ChatClientEvents>;

/** A thread as React Query holds it: pages[0] is the newest page. */
export type ThreadPages = InfiniteData<ConversationThread, string | undefined>;

export function threadKey(id: string) {
  return ['thread', id] as const;
}

/** How long "typing…" stays up without another keystroke behind it. */
const TYPING_TTL_MS = 6_000;

/** Refused handshakes in a row before giving up until the next sign-in or app start. */
const MAX_AUTH_RETRIES = 3;

interface ChatLiveState {
  connected: boolean;
  /** userId → online, from presence events since the socket connected. */
  online: Record<string, boolean>;
  /** conversationId → the other person is typing in it. */
  typing: Record<string, boolean>;
  /** The thread on screen: messages arriving in it are read on arrival. */
  activeConversationId: string | null;
}

export const useChatLive = create<ChatLiveState>(() => ({
  connected: false,
  online: {},
  typing: {},
  activeConversationId: null,
}));

/** Online now: the live value once one has arrived, the server's until then. */
export function useOnline(userId: string | undefined, fromServer: boolean): boolean {
  const live = useChatLive((s) => (userId ? s.online[userId] : undefined));
  return live ?? fromServer;
}

export function useTyping(conversationId: string | undefined): boolean {
  return useChatLive((s) => (conversationId ? s.typing[conversationId] === true : false));
}

export function setActiveConversation(id: string | null): void {
  useChatLive.setState({ activeConversationId: id });
}

let socket: ChatSocket | null = null;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Refused handshakes since the last success; reset whenever the app returns. */
let authFailures = 0;

/**
 * Keeps the chat connected while signed in. Mounted once, by the signed-in
 * layout, so every screen under it gets live updates.
 */
export function useChatConnection(): void {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === 'authenticated');

  useEffect(() => {
    if (!signedIn) return;
    const chat = connect(queryClient);

    // A phone drops the socket in the background sooner or later anyway.
    // Closing it on purpose means the other side sees "offline" at once
    // instead of a minute later; coming back reconnects and catches up.
    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active' && !chat.connected) {
              authFailures = 0;
              chat.connect();
            }
            if (state === 'background') chat.disconnect();
          });

    return () => {
      appState?.remove();
      chat.removeAllListeners();
      chat.disconnect();
      if (socket === chat) socket = null;
      typingTimers.forEach(clearTimeout);
      typingTimers.clear();
      useChatLive.setState({ connected: false, online: {}, typing: {} });
    };
  }, [signedIn, queryClient]);
}

/** Everything in this thread has been seen — over the socket, or HTTP when it is down. */
export function markRead(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('conversation:read', { conversationId });
  } else {
    markThreadRead(conversationId).catch(() => undefined);
  }
}

/** "I am typing" is worthless late, so it is dropped rather than queued offline. */
export function sendTyping(conversationId: string, typing: boolean): void {
  if (socket?.connected) socket.volatile.emit('typing', { conversationId, typing });
}

/** Put a message into its thread, if that thread is loaded: in place, or as the newest. */
export function upsertMessage(queryClient: QueryClient, message: Message): void {
  queryClient.setQueryData<ThreadPages>(threadKey(message.conversationId), (data) => {
    const newest = data?.pages[0];
    if (!data || !newest) return data;

    let found = false;
    const pages = data.pages.map((page) => {
      const index = page.messages.findIndex((row) => row.id === message.id);
      if (index < 0) return page;
      found = true;
      const current = page.messages[index]!;
      const messages = page.messages.slice();
      messages[index] = {
        ...message,
        // A copy that left the server before the read must not undo it.
        status: current.status === 'SEEN' ? 'SEEN' : message.status,
        clientId: message.clientId ?? current.clientId,
      };
      return { ...page, messages };
    });
    if (found) return { ...data, pages };

    return {
      ...data,
      pages: [{ ...newest, messages: [...newest.messages, message] }, ...data.pages.slice(1)],
    };
  });
}

// --- internals ---

/** "http://192.168.0.14:3000" and "/api/v1/socket.io", from ".../api/v1". */
function endpoint(): { origin: string; path: string } {
  const match = /^(https?:\/\/[^/]+)(\/.*)?$/.exec(env.apiUrl.trim());
  const origin = match?.[1] ?? env.apiUrl;
  const base = (match?.[2] ?? '').replace(/\/+$/, '');
  // Wherever the API is mounted, the socket is mounted beside it.
  return { origin, path: base ? `${base}/socket.io` : CHAT_SOCKET_PATH };
}

function connect(queryClient: QueryClient): ChatSocket {
  const { origin, path } = endpoint();
  authFailures = 0;

  const chat: ChatSocket = io(`${origin}${CHAT_SOCKET_NAMESPACE}`, {
    path,
    // React Native has WebSocket, but no dependable long-polling fallback.
    transports: ['websocket'],
    // Read on every attempt, so a reconnect presents the newest token.
    auth: (send) => send({ token: useAuthStore.getState().accessToken ?? '' }),
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });
  socket = chat;

  chat.on('connect', () => {
    authFailures = 0;
    // Whatever happened while disconnected comes from refetching. Presence
    // is dropped too: the refetched lists carry who is online now.
    useChatLive.setState({ connected: true, online: {}, typing: {} });
    void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    void queryClient.invalidateQueries({ queryKey: ['thread'] });
  });

  chat.on('disconnect', () => useChatLive.setState({ connected: false }));

  chat.on('connect_error', (error) => {
    // Socket.IO retries network failures itself, but not a handshake the
    // server refused — usually an access token that expired while the app
    // was closed. Refresh it and try again, a few times at most.
    if (chat.active || error.message !== 'unauthorized') return;
    if (authFailures >= MAX_AUTH_RETRIES) return;
    authFailures += 1;
    refreshAccessToken().then(
      () => chat.connect(),
      // The session itself has gone; the next HTTP request signs them out.
      () => undefined,
    );
  });

  chat.on('message:new', (message) => onMessage(queryClient, message));
  chat.on('conversation:read', (event) => onRead(queryClient, event));
  chat.on('conversation:changed', ({ conversationId }) => {
    void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    void queryClient.invalidateQueries({ queryKey: threadKey(conversationId) });
  });
  chat.on('typing', onTyping);
  chat.on('presence', ({ userId, online }) =>
    useChatLive.setState((s) => ({ online: { ...s.online, [userId]: online } })),
  );

  return chat;
}

function onMessage(queryClient: QueryClient, message: Message): void {
  upsertMessage(queryClient, message);

  const onScreen =
    useChatLive.getState().activeConversationId === message.conversationId &&
    AppState.currentState === 'active';

  if (!message.mine) {
    // A message ends the "typing…" that came before it.
    clearTyping(message.conversationId);
    // Read the moment it lands if the thread is open: the sender's tick
    // turns double while they are still looking at it.
    if (onScreen) markRead(message.conversationId);
  }

  // The list: patched where it already shows the thread, refetched where the
  // thread is new to it.
  const unseen = !message.mine && !onScreen ? 1 : 0;
  let found = false;
  queryClient.setQueriesData<Inbox>({ queryKey: ['inbox'] }, (inbox) => {
    const row = inbox?.conversations.find((item) => item.id === message.conversationId);
    if (!inbox || !row) return inbox;
    found = true;
    const updated = {
      ...row,
      lastMessage: {
        body: message.body ?? row.lastMessage?.body ?? '',
        kind: message.kind,
        createdAt: message.createdAt,
        mine: message.mine,
        status: message.status,
      },
      lastMessageAt: message.createdAt,
      unread: row.unread + unseen,
    };
    return {
      conversations: [updated, ...inbox.conversations.filter((item) => item !== row)],
      counts: { ...inbox.counts, unread: inbox.counts.unread + unseen },
    };
  });
  if (!found) void queryClient.invalidateQueries({ queryKey: ['inbox'] });
}

function onRead(queryClient: QueryClient, event: ChatReadEvent): void {
  const readAt = Date.parse(event.readAt);

  // Their read: my messages up to that moment get their second tick.
  queryClient.setQueryData<ThreadPages>(threadKey(event.conversationId), (data) => {
    const first = data?.pages[0];
    if (!data || !first || first.conversation.correspondent.id !== event.userId) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        messages: page.messages.map((row) =>
          row.mine && row.status === 'SENT' && Date.parse(row.createdAt) <= readAt
            ? { ...row, status: 'SEEN' as const }
            : row,
        ),
      })),
    };
  });

  queryClient.setQueriesData<Inbox>({ queryKey: ['inbox'] }, (inbox) => {
    const row = inbox?.conversations.find((item) => item.id === event.conversationId);
    if (!inbox || !row) return inbox;

    if (row.correspondent.id === event.userId) {
      const last = row.lastMessage;
      if (!last?.mine || last.status === 'SEEN' || Date.parse(last.createdAt) > readAt) return inbox;
      return {
        ...inbox,
        conversations: inbox.conversations.map((item) =>
          item === row ? { ...item, lastMessage: { ...last, status: 'SEEN' as const } } : item,
        ),
      };
    }

    // My own read, on this phone or another: nothing left unread in it.
    if (row.unread === 0) return inbox;
    return {
      conversations: inbox.conversations.map((item) =>
        item === row ? { ...item, unread: 0 } : item,
      ),
      counts: { ...inbox.counts, unread: Math.max(0, inbox.counts.unread - row.unread) },
    };
  });
}

function onTyping({ conversationId, typing }: ChatTypingEvent): void {
  clearTimeout(typingTimers.get(conversationId));
  typingTimers.delete(conversationId);
  // Expires by itself: a "stopped typing" lost on the way must not leave
  // "typing…" up for good.
  if (typing) {
    typingTimers.set(conversationId, setTimeout(() => clearTyping(conversationId), TYPING_TTL_MS));
  }
  useChatLive.setState((s) => ({ typing: { ...s.typing, [conversationId]: typing } }));
}

function clearTyping(conversationId: string): void {
  clearTimeout(typingTimers.get(conversationId));
  typingTimers.delete(conversationId);
  if (!useChatLive.getState().typing[conversationId]) return;
  useChatLive.setState((s) => ({ typing: { ...s.typing, [conversationId]: false } }));
}
