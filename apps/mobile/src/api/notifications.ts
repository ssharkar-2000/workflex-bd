import {
  activityFeedSchema,
  notificationFeedSchema,
  unreadCountSchema,
  type ActivityFeed,
  type NotificationFeed,
} from '@workflex/shared';
import { api } from './client';

export async function fetchNotifications(): Promise<NotificationFeed> {
  const { data } = await api.get('/notifications');
  return notificationFeedSchema.parse(data);
}

/** Just the badge number — cheaper than pulling the whole feed for it. */
export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return unreadCountSchema.parse(data).unreadCount;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

/**
 * Things that happened to this account, newest first.
 *
 * Separate from `fetchNotifications`, which is the announcement feed the bell
 * counts. This one merges announcements with the events derived from the
 * account's own rows — see the note on `activityEventKindSchema`.
 */
export async function fetchActivityFeed(): Promise<ActivityFeed> {
  const { data } = await api.get('/me/activity-feed');
  return activityFeedSchema.parse(data);
}
