import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  publicIdCandidates,
  type Conversation,
  type ConversationSection,
  type ConversationThread,
  type Correspondent,
  type Inbox,
  type InboxFilter,
  type Message,
  type SendMessageDto,
  type StartConversationDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { ChatRealtime } from './chat-realtime.service';

/** How many messages a thread opens with. */
const THREAD_PAGE = 50;

/** Threads whose two seats are remembered for typing events. */
const PARTICIPANT_CACHE = 5_000;

/**
 * Messaging, tied to work — plus direct messages between two people.
 *
 * Most conversations exist because somebody applied to a job or was hired
 * for it. The pair (job, worker) is unique: the same two people about two
 * jobs get two threads, which is what they would want.
 *
 * A direct message is started from the other person's WorkFlex id instead.
 * The id has to be typed in full — there is no browsing or partial search —
 * so you can only write to someone who gave you theirs, which keeps this
 * from becoming a way to message strangers. Either side can block it.
 *
 * Both sides read the same rows. Which section of the inbox a thread sits in
 * is decided per reader, because the same thread is an application to one of
 * them and hiring to the other.
 *
 * Everything that changes a thread is also pushed over the chat socket (see
 * MessagingGateway) so an open screen updates without asking.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  /** conversationId → its two seats, which never change once created. */
  private readonly participants = new Map<string, readonly [string, string]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: ChatRealtime,
  ) {}

  async inbox(userId: string, filter: InboxFilter, search?: string): Promise<Inbox> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        AND: [
          { OR: [{ workerId: userId }, { recruiterId: userId }] },
          // A direct thread is listed once something has been said in it:
          // looking someone up and opening the chat must not put an empty
          // thread from a stranger in their inbox.
          { OR: [{ directKey: null }, { messages: { some: {} } }] },
          ...(search ? [searchFor(userId, search)] : []),
        ],
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
      direct: all.filter((row) => row.section === 'DIRECT').length,
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
      include: { author: { select: AUTHOR_SELECT } },
    });

    const hasMore = messages.length > THREAD_PAGE;
    const page = hasMore ? messages.slice(0, THREAD_PAGE) : messages;

    const read = await this.advanceRead(userId, row);

    const shifts = await this.shiftsFor([read]);

    return {
      conversation: await this.toConversation(read, userId, shifts, { readNow: true }),
      // Oldest first: a chat reads downwards.
      messages: page.reverse().map((message) => toMessage(message, userId, read)),
      hasMore,
    };
  }

  /** The thread is on screen — from the socket, or the HTTP fallback. */
  async markRead(userId: string, id: string): Promise<void> {
    const row = await this.mine(userId, id);
    await this.advanceRead(userId, row);
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

  /**
   * Who a WorkFlex id belongs to, so the app can show the person before a
   * thread is opened with them. Exact ids only — see publicIdCandidates.
   */
  async lookup(userId: string, publicId: string): Promise<Correspondent> {
    const person = await this.findByPublicId(userId, publicId);
    return {
      ...toCorrespondent(person, true),
      online: this.realtime.isOnline(person.id),
    };
  }

  /** Open the direct thread with the owner of a WorkFlex id, or reopen it. */
  async startDirect(userId: string, publicId: string): Promise<Conversation> {
    const person = await this.findByPublicId(userId, publicId);
    const directKey = [userId, person.id].sort().join(':');

    let conversation: ConversationRow;
    try {
      conversation = await this.prisma.conversation.upsert({
        where: { directKey },
        create: { directKey, workerId: userId, recruiterId: person.id },
        update: {},
        include: CONVERSATION_INCLUDE,
      });
    } catch (err) {
      // Both of them opened the chat at the same moment and the other insert
      // won the unique key — theirs is the thread.
      if ((err as { code?: string }).code !== 'P2002') throw err;
      conversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { directKey },
        include: CONVERSATION_INCLUDE,
      });
    }

    return this.toConversation(conversation, userId, new Map());
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
        include: { author: { select: AUTHOR_SELECT } },
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

    const seats =
      row.workerId === userId
        ? { ...row, workerReadAt: created.createdAt }
        : { ...row, recruiterReadAt: created.createdAt };
    const other = row.workerId === userId ? row.recruiterId : row.workerId;

    // To the other person, and to the sender's other phones. Each gets their
    // own view of it — `mine` is true for one of them only.
    this.realtime.emit(other, 'message:new', toMessage(created, other, seats));
    this.realtime.emit(userId, 'message:new', toMessage(created, userId, seats, dto.clientId));

    return toMessage(created, userId, seats, dto.clientId);
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
    this.realtime.emit([row.workerId, row.recruiterId], 'conversation:changed', {
      conversationId: id,
    });

    const shifts = await this.shiftsFor([updated]);
    return this.toConversation(updated, userId, shifts);
  }

  /** The other seat of a thread this person is in, or null if they are not in it. */
  async otherParticipant(userId: string, id: string): Promise<string | null> {
    let seats = this.participants.get(id);
    if (!seats) {
      const row = await this.prisma.conversation.findUnique({
        where: { id },
        select: { workerId: true, recruiterId: true },
      });
      if (!row) return null;
      seats = [row.workerId, row.recruiterId] as const;
      if (this.participants.size >= PARTICIPANT_CACHE) this.participants.clear();
      this.participants.set(id, seats);
    }
    if (seats[0] === userId) return seats[1];
    if (seats[1] === userId) return seats[0];
    return null;
  }

  /**
   * Everyone connected right now who shares an open thread with this
   * person — who hears when they come online or go. A blocked thread does
   * not count: blocking someone also stops them watching you.
   */
  async correspondentsOf(userId: string): Promise<string[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ workerId: userId }, { recruiterId: userId }], blockedAt: null },
      orderBy: { lastMessageAt: 'desc' },
      take: 500,
      select: { workerId: true, recruiterId: true },
    });

    const people = new Set<string>();
    for (const row of rows) people.add(row.workerId === userId ? row.recruiterId : row.workerId);
    people.delete(userId);
    return [...people].filter((id) => this.realtime.isOnline(id));
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

  private async findByPublicId(userId: string, publicId: string) {
    const person = await this.prisma.user.findFirst({
      where: { publicId: { in: publicIdCandidates(publicId) }, status: 'ACTIVE' },
      select: PERSON_SELECT,
    });
    if (!person) {
      throw new AppException(
        ApiErrorCode.NOT_FOUND,
        'No account has that WorkFlex id',
        HttpStatus.NOT_FOUND,
      );
    }
    if (person.id === userId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That is your own WorkFlex id',
        HttpStatus.BAD_REQUEST,
      );
    }
    return person;
  }

  /**
   * Move this reader's read time up to the newest message, and tell both
   * sides: the writer's ticks turn double, and the reader's other phones
   * clear their unread badge.
   *
   * Up to the newest message rather than "now": its timestamp comes from the
   * same clock as every other message's, so a message stored a moment
   * earlier can never be counted as read because the API's clock runs ahead
   * of the database's.
   */
  private async advanceRead(userId: string, row: ConversationRow): Promise<ConversationRow> {
    const iAmWorker = row.workerId === userId;
    const current = iAmWorker ? row.workerReadAt : row.recruiterReadAt;
    const newest = row.messages[0]?.createdAt ?? null;
    if (!newest || (current && current >= newest)) return row;

    // Conditional, so two phones reading at once can never move it backwards.
    const { count } = await this.prisma.conversation.updateMany({
      where: iAmWorker
        ? { id: row.id, OR: [{ workerReadAt: null }, { workerReadAt: { lt: newest } }] }
        : { id: row.id, OR: [{ recruiterReadAt: null }, { recruiterReadAt: { lt: newest } }] },
      data: iAmWorker ? { workerReadAt: newest } : { recruiterReadAt: newest },
    });

    if (count > 0) {
      this.realtime.emit([row.workerId, row.recruiterId], 'conversation:read', {
        conversationId: row.id,
        userId,
        readAt: newest.toISOString(),
      });
    }

    return iAmWorker ? { ...row, workerReadAt: newest } : { ...row, recruiterReadAt: newest };
  }

  /** The shift for each (job, worker) pair, where one exists. */
  private async shiftsFor(rows: { jobId: string | null; workerId: string }[]) {
    const pairs = rows.flatMap((row) =>
      row.jobId ? [{ jobId: row.jobId, workerId: row.workerId }] : [],
    );
    if (pairs.length === 0) return new Map<string, ShiftBrief>();

    const shifts = await this.prisma.shift.findMany({
      where: {
        OR: pairs,
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
    const otherReadAt = iAmWorker ? row.recruiterReadAt : row.workerReadAt;
    const direct = row.directKey !== null;
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

    // A direct thread is only ever direct. Otherwise a thread about work
    // that is scheduled is about that work, whichever side you are on.
    const section: ConversationSection = direct
      ? 'DIRECT'
      : shift
        ? 'WORK'
        : iAmWorker
          ? 'APPLICATION'
          : 'HIRING';

    return {
      id: row.id,
      section,
      job: row.job ? { id: row.job.id, title: row.job.title } : null,
      shift: shift
        ? {
            id: shift.id,
            startsAt: shift.startsAt.toISOString(),
            endsAt: shift.endsAt.toISOString(),
            status: shift.status,
          }
        : null,
      applicationStatus:
        row.job?.applications.find((application) => application.userId === row.workerId)
          ?.status ?? null,
      correspondent: {
        ...toCorrespondent(other, direct),
        // Blocking also hides whether you are online.
        online: row.blockedAt === null && this.realtime.isOnline(other.id),
      },
      lastMessage: last
        ? {
            body: last.body ?? kindLabel(last.kind),
            kind: last.kind,
            createdAt: last.createdAt.toISOString(),
            mine: last.authorId === userId,
            status: otherReadAt && otherReadAt >= last.createdAt ? 'SEEN' : 'SENT',
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

const PERSON_SELECT = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  phone: true,
  verificationLevel: true,
  company: { select: { name: true } },
} satisfies Prisma.UserSelect;

const AUTHOR_SELECT = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  phone: true,
} satisfies Prisma.UserSelect;

const CONVERSATION_INCLUDE = {
  job: {
    select: {
      id: true,
      title: true,
      applications: { select: { status: true, userId: true }, take: 5 },
    },
  },
  worker: { select: PERSON_SELECT },
  recruiter: { select: PERSON_SELECT },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { body: true, kind: true, createdAt: true, authorId: true },
  },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof CONVERSATION_INCLUDE }>;

type Person = Prisma.UserGetPayload<{ select: typeof PERSON_SELECT }>;

/** Who wrote to whom, and when each of them last read the thread. */
type Seats = Pick<
  ConversationRow,
  'workerId' | 'recruiterId' | 'workerReadAt' | 'recruiterReadAt' | 'directKey'
>;

type ShiftBrief = {
  id: string;
  jobId: string;
  workerId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

type MessageRow = Prisma.MessageGetPayload<{ include: { author: { select: typeof AUTHOR_SELECT } } }>;

/**
 * A person as the other side of a thread sees them.
 *
 * Someone with no name on the account is shown by phone number in a job
 * thread, where the two already share a job. In a direct thread — reached
 * by an id, perhaps by someone they have never met — it is their WorkFlex
 * id instead: typing an id must not hand out the phone number behind it.
 */
function toCorrespondent(person: Person, direct: boolean): Correspondent {
  return {
    id: person.id,
    publicId: person.publicId,
    name:
      [person.firstName, person.lastName].filter(Boolean).join(' ') ||
      (direct ? person.publicId : person.phone),
    company: person.company?.name ?? null,
    verified: person.verificationLevel >= 1,
    online: false,
  };
}

/** Matches the job's title, or the other person's name, company or id — every word. */
function searchFor(userId: string, search: string): Prisma.ConversationWhereInput {
  const words = search.split(/\s+/).filter(Boolean).slice(0, 4);

  return {
    AND: words.map((word) => {
      const text = { contains: word, mode: 'insensitive' as const };
      const person: Prisma.UserWhereInput = {
        OR: [
          { firstName: text },
          { lastName: text },
          { publicId: text },
          { company: { is: { name: text } } },
        ],
      };
      return {
        OR: [
          { job: { is: { title: text } } },
          { workerId: { not: userId }, worker: { is: person } },
          { recruiterId: { not: userId }, recruiter: { is: person } },
        ],
      };
    }),
  };
}

function toMessage(row: MessageRow, userId: string, seats: Seats, clientId?: string): Message {
  // Seen once whoever it was written to has read up to it.
  const recipientReadAt =
    row.authorId === seats.workerId ? seats.recruiterReadAt : seats.workerReadAt;

  return {
    id: row.id,
    conversationId: row.conversationId,
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
    status: recipientReadAt && recipientReadAt >= row.createdAt ? 'SEEN' : 'SENT',
    author: {
      id: row.author.id,
      // Never the phone number in a direct thread — see toCorrespondent.
      name:
        [row.author.firstName, row.author.lastName].filter(Boolean).join(' ') ||
        (seats.directKey ? row.author.publicId : row.author.phone),
    },
    ...(clientId ? { clientId } : {}),
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
