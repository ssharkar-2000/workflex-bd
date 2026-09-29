import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  type Conversation,
  type ConversationSection,
  type ConversationThread,
  type Inbox,
  type InboxFilter,
  type Message,
  type SendMessageDto,
  type StartConversationDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/** How many messages a thread opens with. */
const THREAD_PAGE = 50;

/**
 * Messaging, tied to work.
 *
 * A conversation exists because somebody applied to a job or was hired for
 * it — there is no way to message a stranger, which is what keeps this from
 * becoming a channel for spam and for the kind of contact nobody asked for.
 * The pair (job, worker) is unique: the same two people about two jobs get
 * two threads, which is what they would want.
 *
 * Both sides read the same rows. Which section of the inbox a thread sits in
 * is decided per reader, because the same thread is an application to one of
 * them and hiring to the other.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async inbox(userId: string, filter: InboxFilter, search?: string): Promise<Inbox> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        OR: [{ workerId: userId }, { recruiterId: userId }],
        ...(search
          ? {
              OR: [
                { workerId: userId, job: { title: { contains: search, mode: 'insensitive' } } },
                { recruiterId: userId, job: { title: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: CONVERSATION_INCLUDE,
    });

    const shifts = await this.shiftsFor(rows);
    const all = await Promise.all(rows.map((row) => this.toConversation(row, userId, shifts)));

    const counts = {
      all: all.length,
      application: all.filter((row) => row.section === 'APPLICATION').length,
      hiring: all.filter((row) => row.section === 'HIRING').length,
      work: all.filter((row) => row.section === 'WORK').length,
      unread: all.reduce((sum, row) => sum + row.unread, 0),
    };

    const conversations =
      filter === 'ALL' ? all : all.filter((row) => row.section === filter);

    return { conversations, counts };
  }

  /**
   * Open a thread, which also marks it read: opening a conversation is what
   * reading it means, and a separate "mark as read" call would be a second
   * round trip that says nothing new.
   */
  async thread(userId: string, id: string, before?: string): Promise<ConversationThread> {
    const row = await this.mine(userId, id);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: THREAD_PAGE + 1,
      include: { author: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });

    const hasMore = messages.length > THREAD_PAGE;
    const page = hasMore ? messages.slice(0, THREAD_PAGE) : messages;

    await this.markRead(userId, row);

    const shifts = await this.shiftsFor([row]);

    return {
      conversation: await this.toConversation(row, userId, shifts, { readNow: true }),
      // Oldest first: a chat reads downwards.
      messages: page.reverse().map((message) => toMessage(message, userId)),
      hasMore,
    };
  }

  /**
   * Start a thread, or hand back the one that already exists.
   *
   * A worker may write to the poster of a job they applied to; a poster may
   * write to anyone who applied to theirs. Neither can write to somebody
   * with no connection to the job at all.
   */
  async start(userId: string, dto: StartConversationDto): Promise<Conversation> {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, postedBy: true },
    });
    if (!job?.postedBy) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such job', HttpStatus.NOT_FOUND);
    }

    const workerId = job.postedBy === userId ? dto.workerId : userId;
    if (!workerId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'Say who on this job you want to write to',
        HttpStatus.BAD_REQUEST,
      );
    }

    const application = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId: job.id, userId: workerId } },
      select: { status: true },
    });
    if (!application) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'You can only message about a job you applied to or posted',
        HttpStatus.FORBIDDEN,
      );
    }
    if (job.postedBy !== userId && workerId !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'This conversation is not yours',
        HttpStatus.FORBIDDEN,
      );
    }

    const conversation = await this.prisma.conversation.upsert({
      where: { jobId_workerId: { jobId: job.id, workerId } },
      create: { jobId: job.id, workerId, recruiterId: job.postedBy },
      update: {},
      include: CONVERSATION_INCLUDE,
    });

    const shifts = await this.shiftsFor([conversation]);
    return this.toConversation(conversation, userId, shifts);
  }

  async send(userId: string, id: string, dto: SendMessageDto): Promise<Message> {
    const row = await this.mine(userId, id);

    if (row.blockedAt) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'This conversation is blocked',
        HttpStatus.FORBIDDEN,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: id,
          authorId: userId,
          kind: dto.kind,
          body: dto.body?.trim() ? dto.body.trim() : null,
          attachmentKey: dto.attachmentKey ?? null,
          attachmentName: dto.attachmentName ?? null,
          attachmentType: dto.attachmentType ?? null,
          payload: (dto.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      });

      await tx.conversation.update({
        where: { id },
        data: {
          lastMessageAt: message.createdAt,
          // Writing counts as reading: you have seen everything above what
          // you just answered.
          ...(row.workerId === userId
            ? { workerReadAt: message.createdAt }
            : { recruiterReadAt: message.createdAt }),
        },
      });

      return message;
    });

    return toMessage(created, userId);
  }

  /** Stop a thread notifying, without leaving it. */
  async mute(userId: string, id: string, muted: boolean): Promise<Conversation> {
    const row = await this.mine(userId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: row.workerId === userId ? { workerMuted: muted } : { recruiterMuted: muted },
      include: CONVERSATION_INCLUDE,
    });
    const shifts = await this.shiftsFor([updated]);
    return this.toConversation(updated, userId, shifts);
  }

  /**
   * Block, or lift a block.
   *
   * Blocking closes the thread for both sides rather than silently dropping
   * one person's messages: someone whose messages go nowhere should be told,
   * not left talking to a wall.
   */
  async block(userId: string, id: string, blocked: boolean): Promise<Conversation> {
    const row = await this.mine(userId, id);

    if (!blocked && row.blockedBy && row.blockedBy !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the person who blocked this conversation can unblock it',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: blocked
        ? { blockedAt: new Date(), blockedBy: userId }
        : { blockedAt: null, blockedBy: null },
      include: CONVERSATION_INCLUDE,
    });

    this.logger.log(`Conversation ${id} ${blocked ? 'blocked' : 'unblocked'} by ${userId}`);
    const shifts = await this.shiftsFor([updated]);
    return this.toConversation(updated, userId, shifts);
  }

  // --- internals ---

  private async mine(userId: string, id: string) {
    const row = await this.prisma.conversation.findUnique({
      where: { id },
      include: CONVERSATION_INCLUDE,
    });
    if (!row || (row.workerId !== userId && row.recruiterId !== userId)) {
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No such conversation',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async markRead(userId: string, row: ConversationRow): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: row.id },
      data:
        row.workerId === userId ? { workerReadAt: new Date() } : { recruiterReadAt: new Date() },
    });
  }

  /** The shift for each (job, worker) pair, where one exists. */
  private async shiftsFor(rows: { jobId: string; workerId: string }[]) {
    if (rows.length === 0) return new Map<string, ShiftBrief>();

    const shifts = await this.prisma.shift.findMany({
      where: {
        OR: rows.map((row) => ({ jobId: row.jobId, workerId: row.workerId })),
        status: { not: 'CANCELLED' },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, jobId: true, workerId: true, startsAt: true, endsAt: true, status: true },
    });

    const map = new Map<string, ShiftBrief>();
    for (const shift of shifts) {
      const key = `${shift.jobId}:${shift.workerId}`;
      if (!map.has(key)) map.set(key, shift);
    }
    return map;
  }

  private async toConversation(
    row: ConversationRow,
    userId: string,
    shifts: Map<string, ShiftBrief>,
    options: { readNow?: boolean } = {},
  ): Promise<Conversation> {
    const iAmWorker = row.workerId === userId;
    const other = iAmWorker ? row.recruiter : row.worker;
    const readAt = iAmWorker ? row.workerReadAt : row.recruiterReadAt;
    const shift = shifts.get(`${row.jobId}:${row.workerId}`) ?? null;

    const unread = options.readNow
      ? 0
      : await this.prisma.message.count({
          where: {
            conversationId: row.id,
            authorId: { not: userId },
            ...(readAt ? { createdAt: { gt: readAt } } : {}),
          },
        });

    const last = row.messages[0] ?? null;

    return {
      id: row.id,
      // A thread about work that is scheduled is about that work, whichever
      // side you are on.
      section: (shift ? 'WORK' : iAmWorker ? 'APPLICATION' : 'HIRING') as ConversationSection,
      job: { id: row.job.id, title: row.job.title },
      shift: shift
        ? {
            id: shift.id,
            startsAt: shift.startsAt.toISOString(),
            endsAt: shift.endsAt.toISOString(),
            status: shift.status,
          }
        : null,
      applicationStatus: row.job.applications[0]?.status ?? null,
      correspondent: {
        id: other.id,
        publicId: other.publicId,
        name: [other.firstName, other.lastName].filter(Boolean).join(' ') || other.phone,
        company: other.company?.name ?? null,
        verified: other.verificationLevel >= 1,
      },
      lastMessage: last
        ? {
            body: last.body ?? kindLabel(last.kind),
            kind: last.kind,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      unread,
      muted: iAmWorker ? row.workerMuted : row.recruiterMuted,
      blocked: row.blockedAt !== null,
      blockedByMe: row.blockedBy === userId,
      lastMessageAt: row.lastMessageAt.toISOString(),
    };
  }
}

const CONVERSATION_INCLUDE = {
  job: {
    select: {
      id: true,
      title: true,
      applications: { select: { status: true, userId: true }, take: 5 },
    },
  },
  worker: {
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      phone: true,
      verificationLevel: true,
      company: { select: { name: true } },
    },
  },
  recruiter: {
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      phone: true,
      verificationLevel: true,
      company: { select: { name: true } },
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { body: true, kind: true, createdAt: true },
  },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof CONVERSATION_INCLUDE }>;

type ShiftBrief = {
  id: string;
  jobId: string;
  workerId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

type MessageRow = Prisma.MessageGetPayload<{
  include: { author: { select: { id: true; firstName: true; lastName: true; phone: true } } };
}>;

function toMessage(row: MessageRow, userId: string): Message {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    attachmentName: row.attachmentName,
    attachmentType: row.attachmentType,
    // Signed links are minted by the storage module when a message is
    // opened, not stored here; until that is wired the key is not exposed.
    attachmentUrl: null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    mine: row.authorId === userId,
    author: {
      id: row.author.id,
      name:
        [row.author.firstName, row.author.lastName].filter(Boolean).join(' ') ||
        row.author.phone,
    },
  };
}

/** What a message with no words is called in a one-line preview. */
function kindLabel(kind: MessageRow['kind']): string {
  switch (kind) {
    case 'IMAGE':
      return 'Photo';
    case 'FILE':
      return 'File';
    case 'LOCATION':
      return 'Location';
    case 'SHIFT':
      return 'Shift';
    case 'INTERVIEW':
      return 'Interview invitation';
    default:
      return '';
  }
}
