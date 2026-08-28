import {
  notificationFeedSchema,
  unreadCountSchema,
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
