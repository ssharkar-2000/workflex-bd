import { z } from 'zod';

/**
 * Which part of the inbox a thread belongs to.
 *
 * Worked out per reader rather than stored: the same thread is an
 * application to the person who applied and hiring to the person who
 * posted, and becomes work for both once a shift exists.
 */
export const conversationSectionSchema = z.enum(['APPLICATION', 'HIRING', 'WORK']);
export type ConversationSection = z.infer<typeof conversationSectionSchema>;

export const inboxFilterSchema = z.enum(['ALL', 'APPLICATION', 'HIRING', 'WORK']);
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

export const messageSchema = z.object({
  id: z.string().uuid(),
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
  author: z.object({ id: z.string().uuid(), name: z.string() }),
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
});
export type Correspondent = z.infer<typeof correspondentSchema>;

export const conversationSchema = z.object({
  id: z.string().uuid(),
  section: conversationSectionSchema,
  job: z.object({ id: z.string().uuid(), title: z.string() }),
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
    .object({ body: z.string(), kind: messageKindSchema, createdAt: z.string() })
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
