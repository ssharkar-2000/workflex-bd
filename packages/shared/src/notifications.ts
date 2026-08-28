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
