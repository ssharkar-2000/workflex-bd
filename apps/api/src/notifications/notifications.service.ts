import { Injectable } from '@nestjs/common';
import { AccountType, NotificationAudience, Prisma } from '@prisma/client';
import type { NotificationFeed, UserNotification } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/** How many notices the feed screen shows before it stops scrolling. */
const FEED_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Which notices this account is allowed to see.
   *
   * Audience is expressed in the admin's vocabulary (workers / employers) and
   * the account records `accountType`, so the two are mapped here rather than
   * stored twice. An account that has not finished onboarding has no type yet
   * and sees only the notices addressed to everyone — which is correct: it
   * has not told us which side of the marketplace it is on.
   */
  private async audienceFilter(
    userId: string,
  ): Promise<NotificationAudience[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true },
    });

    const audiences: NotificationAudience[] = [NotificationAudience.ALL];
    if (user?.accountType === AccountType.INDIVIDUAL) {
      audiences.push(NotificationAudience.WORKERS);
    } else if (user?.accountType === AccountType.COMPANY) {
      audiences.push(NotificationAudience.EMPLOYERS);
    }
    return audiences;
  }

  private async where(userId: string): Promise<Prisma.NotificationWhereInput> {
    return {
      // Drafts have no sentAt. A notice nobody has broadcast is not news.
      sentAt: { not: null },
      audience: { in: await this.audienceFilter(userId) },
    };
  }

  async feed(userId: string): Promise<NotificationFeed> {
    const where = await this.where(userId);

    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: FEED_LIMIT,
        // Only this user's read row, so `reads` is either empty or one entry.
        include: { reads: { where: { userId }, select: { readAt: true } } },
      }),
      this.unreadCount(userId),
    ]);

    const items: UserNotification[] = rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      audience: n.audience,
      // Narrowed by the `sentAt: { not: null }` filter, which Prisma's types
      // do not carry through to the result.
      sentAt: (n.sentAt as Date).toISOString(),
      read: n.reads.length > 0,
    }));

    return { items, unreadCount };
  }

  /**
   * Counts every unread notice, not just the ones on the current page — the
   * badge would otherwise stop climbing at the feed limit and quietly lie.
   */
  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { ...(await this.where(userId)), reads: { none: { userId } } },
    });
  }

  /**
   * Idempotent: opening the same notice twice is normal, and the second call
   * must not fail. `createMany` with skipDuplicates leaves the original
   * `readAt` alone, so the timestamp records the first read.
   */
  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notificationRead.createMany({
      data: [{ userId, notificationId }],
      skipDuplicates: true,
    });
  }

  /** Clears the badge. Only touches notices this account can actually see. */
  async markAllRead(userId: string): Promise<void> {
    const unread = await this.prisma.notification.findMany({
      where: { ...(await this.where(userId)), reads: { none: { userId } } },
      select: { id: true },
    });

    if (unread.length === 0) return;

    await this.prisma.notificationRead.createMany({
      data: unread.map((n) => ({ userId, notificationId: n.id })),
      skipDuplicates: true,
    });
  }
}
