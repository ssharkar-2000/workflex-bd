import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(limit = 20) {
    const [items, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.notification.count({ where: { read: false } }),
    ]);
    return { items, unread };
  }

  markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead() {
    const { count } = await this.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { marked: count };
  }
}
