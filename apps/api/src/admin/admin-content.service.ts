import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ApiErrorCode,
  type AdminNotification,
  type AttendanceList,
  type ContentBlock,
  type CreateNotificationDto,
  type RespondTicketDto,
  type SupportList,
  type UpsertContentDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PasswordService } from '../users/password.service';

/** Sections the console writes to, rather than only reports on. */
@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  // --- notifications ---

  async notifications(): Promise<AdminNotification[]> {
    const rows = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      audience: n.audience,
      createdAt: n.createdAt.toISOString(),
      sentAt: n.sentAt?.toISOString() ?? null,
    }));
  }

  /**
   * Recorded as sent immediately. There is no push infrastructure yet, so
   * this is the announcement log rather than a delivery guarantee — the
   * worker app reads the latest notice rather than receiving a push.
   */
  async createNotification(
    dto: CreateNotificationDto,
    adminId: string,
  ): Promise<AdminNotification> {
    const n = await this.prisma.notification.create({
      data: { ...dto, createdBy: adminId, sentAt: new Date() },
    });
    this.logger.log({ adminId, id: n.id }, 'Notification published');
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      audience: n.audience,
      createdAt: n.createdAt.toISOString(),
      sentAt: n.sentAt?.toISOString() ?? null,
    };
  }

  async deleteNotification(id: string): Promise<void> {
    await this.prisma.notification.delete({ where: { id } });
  }

  // --- support ---

  async tickets(status?: string): Promise<SupportList> {
    const where = status && status !== 'ALL' ? { status: status as never } : {};

    const [total, open, tickets] = await Promise.all([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);

    return {
      open,
      total,
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        priority: t.priority,
        response: t.response,
        userName: t.user
          ? [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') ||
            'Unnamed'
          : null,
        userPhone: t.user?.phone ?? null,
        createdAt: t.createdAt.toISOString(),
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
      })),
    };
  }

  async respondToTicket(
    id: string,
    dto: RespondTicketDto,
    adminId: string,
  ): Promise<void> {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!existing) throw AppException.notFound('Ticket not found');

    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        response: dto.response,
        status: dto.status,
        assignedTo: adminId,
        resolvedAt:
          dto.status === 'RESOLVED' || dto.status === 'CLOSED'
            ? new Date()
            : null,
      },
    });
    this.logger.log({ adminId, id, status: dto.status }, 'Ticket updated');
  }

  // --- CMS ---

  async content(): Promise<ContentBlock[]> {
    const rows = await this.prisma.contentBlock.findMany({
      orderBy: { key: 'asc' },
    });
    return rows.map((c) => ({
      id: c.id,
      key: c.key,
      title: c.title,
      body: c.body,
      locale: c.locale,
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /** Upsert by key so editing and creating are the same action. */
  async upsertContent(
    dto: UpsertContentDto,
    adminId: string,
  ): Promise<ContentBlock> {
    const c = await this.prisma.contentBlock.upsert({
      where: { key: dto.key },
      create: { ...dto, updatedBy: adminId },
      update: {
        title: dto.title,
        body: dto.body,
        locale: dto.locale,
        updatedBy: adminId,
      },
    });
    return {
      id: c.id,
      key: c.key,
      title: c.title,
      body: c.body,
      locale: c.locale,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async deleteContent(key: string): Promise<void> {
    await this.prisma.contentBlock.deleteMany({ where: { key } });
  }

  // --- attendance ---

  async attendance(status?: string): Promise<AttendanceList> {
    const where = status && status !== 'ALL' ? { status: status as never } : {};
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [total, today, rows] = await Promise.all([
      this.prisma.attendanceRecord.count(),
      this.prisma.attendanceRecord.count({
        where: { checkInAt: { gte: startOfDay } },
      }),
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: { checkInAt: 'desc' },
        take: 100,
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);

    return {
      total,
      today,
      rows: rows.map((r) => ({
        id: r.id,
        userName:
          [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') ||
          'Unnamed',
        userPhone: r.user.phone,
        status: r.status,
        checkInAt: r.checkInAt.toISOString(),
        checkOutAt: r.checkOutAt?.toISOString() ?? null,
        note: r.note,
      })),
    };
  }

  // --- settings ---

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw AppException.notFound('Admin not found');

    const ok = await this.passwords.verify(currentPassword, admin.passwordHash);
    if (!ok) {
      throw new AppException(
        ApiErrorCode.INVALID_CREDENTIALS,
        'Your current password is not correct.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    this.logger.warn({ adminId }, 'Admin password changed');
  }
}
