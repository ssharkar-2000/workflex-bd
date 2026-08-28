import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ApiErrorCode,
  type CreateSupportTicketDto,
  type MySupportList,
  type MySupportTicket,
} from '@workflex/shared';
import { SupportTicket, TicketStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/**
 * How many tickets one account may have waiting on a reply.
 *
 * Not rate limiting for its own sake — an unbounded queue of duplicates from
 * one frustrated person buries everyone else's tickets, and the throttler
 * cannot see that because each request is minutes apart and perfectly valid.
 */
const MAX_OPEN_PER_USER = 5;

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDto(t: SupportTicket): MySupportTicket {
    return {
      id: t.id,
      subject: t.subject,
      message: t.message,
      status: t.status,
      priority: t.priority,
      response: t.response,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
    };
  }

  async create(
    userId: string,
    dto: CreateSupportTicketDto,
  ): Promise<MySupportTicket> {
    const open = await this.prisma.supportTicket.count({
      where: {
        userId,
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
      },
    });

    if (open >= MAX_OPEN_PER_USER) {
      throw new AppException(
        ApiErrorCode.TOO_MANY_OPEN_TICKETS,
        `Account already has ${open} unanswered tickets`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Priority is left at its default. The reporter does not set it — triage
    // is the console's job, and a self-declared URGENT sorts nothing.
    const ticket = await this.prisma.supportTicket.create({
      data: { userId, subject: dto.subject, message: dto.message },
    });

    this.logger.log(`Support ticket ${ticket.id} raised by user ${userId}`);
    return this.toDto(ticket);
  }

  async mine(userId: string): Promise<MySupportList> {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { tickets: rows.map((t) => this.toDto(t)) };
  }
}
