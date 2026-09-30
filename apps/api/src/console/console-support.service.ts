import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ApiErrorCode } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { displayName, referenceCode } from './console.mappers';

/** A ticket nobody has answered in this long is a backlog item. */
const BACKLOG_DAYS = 3;

/**
 * What people write in, and what the platform writes back.
 *
 * The console calls these complaints; this system calls them support
 * tickets. Same rows, same queue — the mapping is here so the screen keeps
 * the word its users know while the database keeps the word its tables use.
 */
@Injectable()
export class ConsoleSupportService {
  private readonly logger = new Logger(ConsoleSupportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async complaints(params: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const where: Prisma.SupportTicketWhereInput = {};
    if (params.status && params.status !== 'ALL') {
      where.status = ticketStatus(params.status);
    }

    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: TICKET_INCLUDE,
      }),
    ]);

    return {
      items: rows.map((row) => toComplaint(row)),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async complaint(id: string) {
    const row = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });
    if (!row) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such complaint', HttpStatus.NOT_FOUND);
    }
    return toComplaint(row);
  }

  /** Tickets that have sat unanswered long enough to be a problem. */
  async backlog() {
    const threshold = new Date(Date.now() - BACKLOG_DAYS * 24 * 60 * 60 * 1000);
    const count = await this.prisma.supportTicket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { lt: threshold },
      },
    });
    return { count, thresholdDays: BACKLOG_DAYS };
  }

  /** Answer a ticket. The reply is what the person sees. */
  async reply(adminId: string, id: string, message: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such complaint', HttpStatus.NOT_FOUND);
    }

    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        response: message.trim(),
        assignedTo: adminId,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
      },
    });

    this.logger.log(`Complaint ${id} answered by admin ${adminId}`);
    return this.complaint(id);
  }

  /** Move a ticket along: in progress, resolved, closed. */
  async decideComplaint(adminId: string, id: string, action: string) {
    const status =
      action === 'resolve'
        ? 'RESOLVED'
        : action === 'close'
          ? 'CLOSED'
          : action === 'escalate' || action === 'progress'
            ? 'IN_PROGRESS'
            : null;
    if (!status) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        `Cannot ${action} a complaint`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        assignedTo: adminId,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });

    this.logger.log(`Complaint ${id} set to ${status} by admin ${adminId}`);
    return this.complaint(id);
  }

  // --- notices ---

  /** What the platform has announced, newest first. */
  async notifications() {
    const rows = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { reads: true } } },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: 'GENERAL',
        title: row.title,
        body: row.body,
        read: row._count.reads > 0,
        createdAt: row.createdAt.toISOString(),
      })),
      unread: rows.filter((row) => row._count.reads === 0).length,
      meta: { total: rows.length, page: 1, limit: rows.length, pages: 1 },
    };
  }

  /**
   * The console's read and read-all.
   *
   * Notices here are announcements to users, not a personal inbox for the
   * admin, so there is nothing per-admin to mark. Answering plainly beats
   * failing a screen over a button that has nothing to change.
   */
  async markRead() {
    return { ok: true, changed: false };
  }

  /** The platform summary the reports screen opens with. */
  async reportSummary() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [users, newUsers, jobs, applications, shifts, payments, tickets] = await Promise.all([
      this.prisma.user.count({ where: { isAdmin: false } }),
      this.prisma.user.count({ where: { isAdmin: false, createdAt: { gte: monthStart } } }),
      this.prisma.job.count(),
      this.prisma.jobApplication.count(),
      this.prisma.shift.count({ where: { status: 'COMPLETED' } }),
      this.prisma.walletPayment.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      accounts: { total: users, newThisMonth: newUsers },
      jobs: { total: jobs, applications },
      work: { shiftsCompleted: shifts },
      money: { payments: payments._count._all, total: payments._sum.amount ?? 0 },
      support: { open: tickets },
    };
  }
}

const TICKET_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, phone: true, accountType: true } },
} satisfies Prisma.SupportTicketInclude;

type TicketRow = Prisma.SupportTicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

function toComplaint(row: TicketRow) {
  const isCompany = row.user?.accountType === 'COMPANY';

  return {
    id: row.id,
    code: referenceCode('C', row.id),
    subject: row.subject,
    body: row.message,
    status: complaintStatus(row.status),
    reporterName: row.user
      ? displayName(row.user.firstName, row.user.lastName, row.user.phone)
      : 'Anonymous',
    resolution: row.response,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    reporterWorkerId: row.user && !isCompany ? row.user.id : null,
    reporterEmployerId: row.user && isCompany ? row.user.id : null,
    // Nothing here answers automatically, so this is always null rather
    // than a time invented to fill the field.
    autoRepliedAt: null,
    assignedAdmin: null,
    replies: row.response
      ? [
          {
            id: `${row.id}-reply`,
            message: row.response,
            createdAt: row.updatedAt.toISOString(),
            authorType: 'ADMIN',
            authorName: null,
            auto: false,
            admin: null,
          },
        ]
      : [],
  };
}

/** The console's five states, from this system's four. */
function complaintStatus(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'RESOLVED':
      return 'RESOLVED';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}

function ticketStatus(status: string): Prisma.EnumTicketStatusFilter {
  switch (status) {
    case 'IN_PROGRESS':
    case 'ESCALATED':
      return { equals: 'IN_PROGRESS' };
    case 'RESOLVED':
      return { equals: 'RESOLVED' };
    case 'CLOSED':
      return { equals: 'CLOSED' };
    default:
      return { equals: 'OPEN' };
  }
}
