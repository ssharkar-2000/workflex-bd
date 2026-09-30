import {
  conversationSchema,
  conversationThreadSchema,
  inboxSchema,
  messageSchema,
  type Conversation,
  type ConversationThread,
  type Inbox,
  type InboxFilter,
  type Message,
  type SendMessageInput,
  type StartConversationInput,
} from '@workflex/shared';
import { api } from './client';

/** The inbox, with section counts and the unread total. */
export async function fetchInbox(filter: InboxFilter, search?: string): Promise<Inbox> {
  const { data } = await api.get('/messages', { params: { filter, search } });
  return inboxSchema.parse(data);
}

/** One thread. Opening it marks it read on the server. */
export async function fetchThread(id: string, before?: string): Promise<ConversationThread> {
  const { data } = await api.get(`/messages/${id}`, { params: { before } });
  return conversationThreadSchema.parse(data);
}

/** Start a thread about a job, or reopen the existing one. */
export async function startConversation(
  input: StartConversationInput,
): Promise<Conversation> {
  const { data } = await api.post('/messages', input);
  return conversationSchema.parse(data);
}

export async function sendMessage(id: string, input: SendMessageInput): Promise<Message> {
  const { data } = await api.post(`/messages/${id}/messages`, input);
  return messageSchema.parse(data);
}

export async function muteConversation(id: string, on: boolean): Promise<Conversation> {
  const { data } = await api.post(`/messages/${id}/mute`, { on });
  return conversationSchema.parse(data);
}

export async function blockConversation(id: string, on: boolean): Promise<Conversation> {
  const { data } = await api.post(`/messages/${id}/block`, { on });
  return conversationSchema.parse(data);
}
