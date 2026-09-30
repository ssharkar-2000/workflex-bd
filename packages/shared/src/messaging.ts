import { z } from 'zod';

/**
 * Which part of the inbox a thread belongs to.
 *
 * Worked out per reader rather than stored: the same thread is an
 * application to the person who applied and hiring to the person who
 * posted, and becomes work for both once a shift exists. A direct message —
 * started from someone's WorkFlex id rather than from a job — is always
 * DIRECT, for both of them.
 */
export const conversationSectionSchema = z.enum(['APPLICATION', 'HIRING', 'WORK', 'DIRECT']);
export type ConversationSection = z.infer<typeof conversationSectionSchema>;

export const inboxFilterSchema = z.enum(['ALL', 'APPLICATION', 'HIRING', 'WORK', 'DIRECT']);
export type InboxFilter = z.infer<typeof inboxFilterSchema>;

export const messageKindSchema = z.enum([
  'TEXT',
  'IMAGE',
  'FILE',
  'LOCATION',
  'SHIFT',
  'INTERVIEW',
  'SYSTEM',
]);
export type MessageKind = z.infer<typeof messageKindSchema>;

/**
 * Whether the person a message was written to has read it: one tick while
 * it has only reached the server, two once they have opened the thread
 * since. Worked out from their read time, not stored per message.
 */
export const messageStatusSchema = z.enum(['SENT', 'SEEN']);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  kind: messageKindSchema,
  body: z.string().nullable(),
  attachmentName: z.string().nullable(),
  attachmentType: z.string().nullable(),
  /** A signed link, minted per request — never a permanent public address. */
  attachmentUrl: z.string().nullable(),
  /** The card's own fields: coordinates, a shift id, an interview time. */
  payload: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  /** True when this account wrote it. */
  mine: z.boolean(),
  status: messageStatusSchema,
  author: z.object({ id: z.string().uuid(), name: z.string() }),
  /**
   * Echoed from the send request, on the reply and the live event only, so
   * the sending phone can swap its placeholder bubble for the real one.
   */
  clientId: z.string().optional(),
});
export type Message = z.infer<typeof messageSchema>;

/** The other person in a thread, as the inbox shows them. */
export const correspondentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  publicId: z.string(),
  /** A company name where the account has one. */
  company: z.string().nullable(),
  /** Identity checked to level 1 or above. */
  verified: z.boolean(),
  /** Connected to the chat right now. */
  online: z.boolean().default(false),
});
export type Correspondent = z.infer<typeof correspondentSchema>;

export const conversationSchema = z.object({
  id: z.string().uuid(),
  section: conversationSectionSchema,
  /** Null for a direct message, which is not about a job. */
  job: z.object({ id: z.string().uuid(), title: z.string() }).nullable(),
  /** Set once this pair has a shift, so the thread can link to it. */
  shift: z
    .object({
      id: z.string().uuid(),
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.string(),
    })
    .nullable(),
  /** Where the application stands, for the context header. */
  applicationStatus: z.string().nullable(),
  correspondent: correspondentSchema,
  lastMessage: z
    .object({
      body: z.string(),
      kind: messageKindSchema,
      createdAt: z.string(),
      /** Written by this account — the list shows its ticks. */
      mine: z.boolean().default(false),
      status: messageStatusSchema.default('SENT'),
    })
    .nullable(),
  unread: z.number().int().nonnegative(),
  muted: z.boolean(),
  blocked: z.boolean(),
  /** True when this account is the one who blocked it. */
  blockedByMe: z.boolean(),
  lastMessageAt: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const inboxSchema = z.object({
  conversations: z.array(conversationSchema),
  counts: z.object({
    all: z.number().int().nonnegative(),
    application: z.number().int().nonnegative(),
    hiring: z.number().int().nonnegative(),
    work: z.number().int().nonnegative(),
    direct: z.number().int().nonnegative().default(0),
    /** Unread messages across every thread — the badge on the menu. */
    unread: z.number().int().nonnegative(),
  }),
});
export type Inbox = z.infer<typeof inboxSchema>;

export const conversationThreadSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema),
  /** More above the oldest message shown. */
  hasMore: z.boolean(),
});
export type ConversationThread = z.infer<typeof conversationThreadSchema>;

export const sendMessageSchema = z
  .object({
    kind: messageKindSchema.default('TEXT'),
    body: z.string().trim().max(4000).optional().or(z.literal('')),
    attachmentKey: z.string().max(400).optional(),
    attachmentName: z.string().max(200).optional(),
    attachmentType: z.string().max(100).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    /** The sending phone's own id for the bubble it is showing already. */
    clientId: z.string().trim().max(64).optional(),
  })
  .refine((message) => Boolean(message.body?.trim()) || Boolean(message.attachmentKey) || Boolean(message.payload), {
    message: 'A message needs something in it',
    path: ['body'],
  });
export type SendMessageDto = z.output<typeof sendMessageSchema>;
export type SendMessageInput = z.input<typeof sendMessageSchema>;

/** Starting a thread: always about a job, never about nothing. */
export const startConversationSchema = z.object({
  jobId: z.string().uuid(),
  /**
   * The worker's account. Omitted by a worker starting a thread about a job
   * they applied to — that is themselves.
   */
  workerId: z.string().uuid().optional(),
});
export type StartConversationDto = z.output<typeof startConversationSchema>;
export type StartConversationInput = z.input<typeof startConversationSchema>;

/**
 * Finding someone to message by the WorkFlex id they gave you ("WF-3A9C1B").
 *
 * An exact match, never a partial one: typing "WF-3" must not list everyone
 * whose id starts that way, or the search becomes a directory of every
 * account. The "WF-" prefix, spaces and case are forgiven.
 */
export const directLookupSchema = z.object({
  publicId: z.string().trim().min(3).max(24),
});
export type DirectLookupDto = z.output<typeof directLookupSchema>;
export type DirectLookupInput = z.input<typeof directLookupSchema>;

/**
 * Every stored id a typed one could mean: "wf 3a9c1b", "3A9C1B" and
 * "WF-3A9C1B" are all "WF-3A9C1B".
 *
 * Usually one answer, but an id that itself begins with WF is ambiguous once
 * the dash is left out — "WFABCD" could be "WF-WFABCD" typed without its
 * prefix, or "WF-ABCD" typed without its dash — so both are returned and
 * the lookup tries each.
 */
export function publicIdCandidates(value: string): string[] {
  const upper = value.trim().toUpperCase().replace(/\s+/g, '');
  if (upper.startsWith('WF-')) {
    return [`WF-${upper.slice(3).replace(/[^A-Z0-9]/g, '')}`];
  }

  const bare = upper.replace(/[^A-Z0-9]/g, '');
  const candidates = [`WF-${bare}`];
  if (bare.startsWith('WF') && bare.length > 2) candidates.push(`WF-${bare.slice(2)}`);
  return candidates;
}

// --- live events over the chat socket ---

/** The Socket.IO namespace and path the chat lives on. */
export const CHAT_SOCKET_NAMESPACE = '/chat';
export const CHAT_SOCKET_PATH = '/api/v1/socket.io';

export const chatReadEventSchema = z.object({
  conversationId: z.string().uuid(),
  /** Who read it. */
  userId: z.string().uuid(),
  /** Everything written up to this moment has been seen. */
  readAt: z.string(),
});
export type ChatReadEvent = z.infer<typeof chatReadEventSchema>;

export const chatTypingEventSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  typing: z.boolean(),
});
export type ChatTypingEvent = z.infer<typeof chatTypingEventSchema>;

export const chatPresenceEventSchema = z.object({
  userId: z.string().uuid(),
  online: z.boolean(),
});
export type ChatPresenceEvent = z.infer<typeof chatPresenceEventSchema>;

/** What the server sends. */
export interface ChatServerEvents {
  /** A new message in one of your threads, yours or theirs. */
  'message:new': (message: Message) => void;
  /** Someone read a thread up to `readAt` — turns your ticks double. */
  'conversation:read': (event: ChatReadEvent) => void;
  /** A thread changed in a way the list should show: blocked, unblocked, started. */
  'conversation:changed': (event: { conversationId: string }) => void;
  typing: (event: ChatTypingEvent) => void;
  presence: (event: ChatPresenceEvent) => void;
  /** A meeting you host or are invited to was created, changed, joined or left. */
  'meeting:changed': (event: { meetingId: string }) => void;
}

/** What the phone sends. */
export interface ChatClientEvents {
  /** "I am looking at this thread" — marks it read and tells the other side. */
  'conversation:read': (
    event: { conversationId: string },
    ack?: (result: { ok: boolean }) => void,
  ) => void;
  typing: (event: { conversationId: string; typing: boolean }) => void;
}
