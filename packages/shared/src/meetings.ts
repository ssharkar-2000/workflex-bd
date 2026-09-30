import { z } from 'zod';

/**
 * Meetings: scheduled video calls (and in-person sessions) between people on
 * the platform, built for interviews.
 *
 * A meeting is created by a host, who invites others. Everybody sees it in
 * their Meetings list; the video itself runs on LiveKit, and the server only
 * ever hands out a short-lived pass into the room for someone who is on the
 * guest list.
 */

export const meetingKindSchema = z.enum(['VIDEO', 'IN_PERSON']);
export type MeetingKind = z.infer<typeof meetingKindSchema>;

export const meetingStatusSchema = z.enum(['SCHEDULED', 'ENDED', 'CANCELLED']);
export type MeetingStatus = z.infer<typeof meetingStatusSchema>;

export const meetingRecurrenceSchema = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);
export type MeetingRecurrence = z.infer<typeof meetingRecurrenceSchema>;

export const meetingResponseSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED']);
export type MeetingResponse = z.infer<typeof meetingResponseSchema>;

export const meetingRoleSchema = z.enum(['HOST', 'GUEST']);
export type MeetingRole = z.infer<typeof meetingRoleSchema>;

/** Which list the Meetings screen is showing. */
export const meetingTabSchema = z.enum(['UPCOMING', 'PAST', 'ORGANIZED']);
export type MeetingTab = z.infer<typeof meetingTabSchema>;

/** Timing rules, in one place so the form and the server cannot disagree. */
export const MEETING_LIMITS = {
  minMinutes: 5,
  maxMinutes: 480,
  maxGuests: 30,
  maxOccurrences: 12,
  /** A meeting may be scheduled to start a little in the past ("start now"). */
  startGraceMinutes: 10,
} as const;

/** How early each side may come in, and how long the door stays open after. */
export const MEETING_JOIN = {
  hostEarlyMinutes: 60,
  guestEarlyMinutes: 15,
  lateMinutes: 120,
} as const;

/** Somebody on a guest list. No phone number: a name and a WorkFlex ID are enough. */
export const meetingPersonSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  verified: z.boolean(),
});
export type MeetingPerson = z.infer<typeof meetingPersonSchema>;

export const meetingParticipantSchema = meetingPersonSchema.extend({
  role: meetingRoleSchema,
  response: meetingResponseSchema,
  /** In the call right now. */
  inCall: z.boolean(),
});
export type MeetingParticipant = z.infer<typeof meetingParticipantSchema>;

/** A room somebody can book for an in-person meeting. */
export const physicalRoomSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable(),
  capacity: z.number().int().nullable(),
});
export type PhysicalRoom = z.infer<typeof physicalRoomSchema>;

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'Give the room a name').max(80),
  location: z.string().trim().max(160).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
});
export type CreateRoomDto = z.output<typeof createRoomSchema>;
export type CreateRoomInput = z.input<typeof createRoomSchema>;

export const meetingSchema = z.object({
  id: z.string().uuid(),
  /** Set when this is one of a repeating series. */
  seriesId: z.string().uuid().nullable(),
  title: z.string(),
  kind: meetingKindSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  agenda: z.string().nullable(),
  notes: z.string().nullable(),
  status: meetingStatusSchema,
  recurrence: meetingRecurrenceSchema,
  /** Somebody is in the call right now. */
  live: z.boolean(),
  /** This account may go in now: right meeting, right time, and not cancelled. */
  canJoin: z.boolean(),
  /** When the door opens for this account. */
  joinOpensAt: z.string(),
  iAmHost: z.boolean(),
  myResponse: meetingResponseSchema.nullable(),
  host: meetingPersonSchema,
  participants: z.array(meetingParticipantSchema),
  room: physicalRoomSchema.nullable(),
  /** The address to share: opens the meeting room in a browser. */
  link: z.string(),
});
export type Meeting = z.infer<typeof meetingSchema>;

export const meetingsOverviewSchema = z.object({
  meetings: z.array(meetingSchema),
  counts: z.object({
    upcoming: z.number().int().nonnegative(),
    past: z.number().int().nonnegative(),
    organized: z.number().int().nonnegative(),
    templates: z.number().int().nonnegative(),
  }),
  /** False until video calls are set up on the server. */
  callsEnabled: z.boolean(),
});
export type MeetingsOverview = z.infer<typeof meetingsOverviewSchema>;

/** A saved set of meeting settings, to fill the form in one tap. */
export const meetingTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  title: z.string(),
  kind: meetingKindSchema,
  durationMinutes: z.number().int(),
  agenda: z.string().nullable(),
  notes: z.string().nullable(),
  recurrence: meetingRecurrenceSchema,
  repeatCount: z.number().int(),
  participants: z.array(meetingPersonSchema),
  physicalRoomId: z.string().uuid().nullable(),
});
export type MeetingTemplate = z.infer<typeof meetingTemplateSchema>;

export const scheduleMeetingSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the meeting a title').max(120),
    kind: meetingKindSchema.default('VIDEO'),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    agenda: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    /** Account ids of the people to invite. The host is added automatically. */
    participantIds: z.array(z.string().uuid()).max(MEETING_LIMITS.maxGuests).default([]),
    recurrence: meetingRecurrenceSchema.default('NONE'),
    /** How many meetings a repeating schedule makes, this one included. */
    repeatCount: z.number().int().min(1).max(MEETING_LIMITS.maxOccurrences).default(1),
    physicalRoomId: z.string().uuid().optional(),
    saveAsTemplate: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const minutes = (Date.parse(value.endsAt) - Date.parse(value.startsAt)) / 60_000;
    if (!(minutes >= MEETING_LIMITS.minMinutes)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: `A meeting must run at least ${MEETING_LIMITS.minMinutes} minutes`,
      });
    } else if (minutes > MEETING_LIMITS.maxMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: `A meeting can run at most ${MEETING_LIMITS.maxMinutes / 60} hours`,
      });
    }
  });
export type ScheduleMeetingDto = z.output<typeof scheduleMeetingSchema>;
export type ScheduleMeetingInput = z.input<typeof scheduleMeetingSchema>;

export const respondMeetingSchema = z.object({
  response: z.enum(['ACCEPTED', 'DECLINED']),
});
export type RespondMeetingDto = z.output<typeof respondMeetingSchema>;

export const cancelMeetingSchema = z.object({
  /** Just this one, or every meeting still to come in the series. */
  scope: z.enum(['ONE', 'SERIES']).default('ONE'),
});
export type CancelMeetingDto = z.output<typeof cancelMeetingSchema>;
export type CancelMeetingInput = z.input<typeof cancelMeetingSchema>;

/** Who the host can invite without typing an ID: people they already deal with. */
export const meetingContactsSchema = z.object({
  contacts: z.array(meetingPersonSchema),
});
export type MeetingContacts = z.infer<typeof meetingContactsSchema>;

/** What the server hands back to go into the room. */
export const joinMeetingResultSchema = z.object({
  /** The LiveKit server to connect to (wss://…). */
  url: z.string(),
  /** A short-lived pass into this room, for this person only. */
  token: z.string(),
  roomName: z.string(),
  identity: z.string(),
  /** The name others will see. */
  name: z.string(),
  title: z.string(),
  /** Opens the room in a browser with the pass already in it. */
  joinUrl: z.string(),
});
export type JoinMeetingResult = z.infer<typeof joinMeetingResultSchema>;

/** The message an in-call chat line travels as (LiveKit data channel, topic "chat"). */
export const MEETING_CHAT_TOPIC = 'chat';
export const meetingChatMessageSchema = z.object({
  id: z.string().max(64),
  text: z.string().trim().min(1).max(2000),
  /** Milliseconds since the epoch, on the sender's clock. */
  ts: z.number(),
});
export type MeetingChatMessage = z.infer<typeof meetingChatMessageSchema>;
