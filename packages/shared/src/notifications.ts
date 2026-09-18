import { z } from 'zod';
import { notificationAudienceSchema } from './admin-sections';

/**
 * The reader's half of notifications.
 *
 * `admin-sections.ts` owns the writer's half — what a staff member composes
 * and broadcasts. This is what an ordinary account sees: the same notices,
 * filtered to the ones addressed to them, each carrying whether *they* have
 * opened it.
 */

export const userNotificationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  audience: notificationAudienceSchema,
  /** Never null here — the feed only returns notices that actually went out. */
  sentAt: z.string(),
  read: z.boolean(),
});
export type UserNotification = z.infer<typeof userNotificationSchema>;

export const notificationFeedSchema = z.object({
  items: z.array(userNotificationSchema),
  /**
   * Sent separately rather than counted from `items`: the badge has to stay
   * right even though the list is capped, and the bell asks for the count on
   * its own without pulling the whole feed.
   */
  unreadCount: z.number().int().min(0),
});
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;

export const unreadCountSchema = z.object({
  unreadCount: z.number().int().min(0),
});
export type UnreadCount = z.infer<typeof unreadCountSchema>;

/**
 * Things that happened to this account, as opposed to things announced to
 * everyone.
 *
 * Derived from the rows that already record them — an application's status and
 * `updatedAt`, an applicant's `appliedAt`, a KYC decision's `reviewedAt` —
 * rather than written to a table of their own. Two reasons. A derived feed
 * cannot drift from the truth it describes: an application that is shortlisted
 * *is* the notification, so there is no second copy to fall out of date. And
 * writing events would need a hook in every flow that changes one of those
 * rows, each an opportunity to forget one and leave someone uninformed.
 *
 * The cost is that "read" cannot be tracked per event, so these carry no
 * unread state and the bell keeps counting announcements only. That is worth
 * paying until someone asks to mark an event read.
 *
 * Two kinds the design for this asked for are absent because nothing records
 * them. There is no messaging in this product — no table, no screen, no way to
 * send one — so "ABC Company sent you a message" could only be fiction. And
 * "TypeScript demand increased" needs a history of past demand to compare
 * against; only today's demand is computable, which is what the NextSkill card
 * already says without pretending it is news that arrived three hours ago.
 */
export const activityEventKindSchema = z.enum([
  /** An employer opened your application. */
  'APPLICATION_VIEWED',
  'APPLICATION_SHORTLISTED',
  'APPLICATION_ACCEPTED',
  'APPLICATION_REJECTED',
  /** Someone applied to a posting you own. */
  'NEW_APPLICANT',
  'VERIFICATION_APPROVED',
  'VERIFICATION_ON_HOLD',
  'VERIFICATION_REJECTED',
  /** An admin broadcast, kept in the same stream so nothing is missed. */
  'ANNOUNCEMENT',
]);
export type ActivityEventKind = z.infer<typeof activityEventKindSchema>;

export const activityEventSchema = z.object({
  /** Stable per event, so the list can key on it without re-rendering. */
  id: z.string(),
  kind: activityEventKindSchema,
  /**
   * What the event is about — a job title, or an announcement's headline.
   *
   * The sentence around it is built in the app from `kind`, so both languages
   * read naturally instead of being assembled from server-side fragments.
   */
  subject: z.string().nullable(),
  /** The employer, the applicant count, the reason a review was refused. */
  detail: z.string().nullable(),
  at: z.string().datetime(),
  /** Where tapping it goes, or null when there is nowhere useful. */
  href: z.string().nullable(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const activityFeedSchema = z.object({
  events: z.array(activityEventSchema),
});
export type ActivityFeed = z.infer<typeof activityFeedSchema>;
