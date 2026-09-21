import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserNotificationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserNotificationsReadService {
  constructor(private readonly prisma: PrismaService) {}

  async outbox(params: { workerId?: string; employerId?: string; kind?: string; limit: number }) {
    const where: Prisma.UserNotificationWhereInput = {
      ...(params.workerId ? { workerId: params.workerId } : {}),
      ...(params.employerId ? { employerId: params.employerId } : {}),
      ...(params.kind && params.kind in UserNotificationKind
        ? { kind: params.kind as UserNotificationKind }
        : {}),
    };

    const [items, unread] = await this.prisma.$transaction([
      this.prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(params.limit, 100),
        include: {
          worker: { select: { id: true, code: true, fullName: true } },
          employer: { select: { id: true, code: true, fullName: true } },
        },
      }),
      this.prisma.userNotification.count({ where: { ...where, read: false } }),
    ]);

    return { items, unread };
  }

  /// `since` lets the app ask only for what arrived after the last poll,
  /// which is what keeps the popup from re-firing for messages it already
  /// showed.
  async inbox(params: { workerId?: string; employerId?: string; since?: string }) {
    if (!params.workerId && !params.employerId) {
      throw new BadRequestException('Ask for an inbox by worker or by employer.');
    }

    const since = params.since ? new Date(params.since) : null;
    const where: Prisma.UserNotificationWhereInput = {
      ...(params.workerId ? { workerId: params.workerId } : { employerId: params.employerId }),
      ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
    };

    const [items, unread] = await this.prisma.$transaction([
      this.prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.userNotification.count({
        where: {
          ...(params.workerId ? { workerId: params.workerId } : { employerId: params.employerId }),
          read: false,
        },
      }),
    ]);

    return { items, unread, checkedAt: new Date().toISOString() };
  }

  markRead(id: string) {
    return this.prisma.userNotification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }
}
