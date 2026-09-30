import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  ApiErrorCode,
  MEETING_LIMITS,
  type CancelMeetingDto,
  type CreateRoomDto,
  type JoinMeetingResult,
  type Meeting,
  type MeetingContacts,
  type MeetingParticipant,
  type MeetingPerson,
  type MeetingResponse,
  type MeetingRole,
  type MeetingTab,
  type MeetingTemplate,
  type MeetingsOverview,
  type PhysicalRoom,
  type ScheduleMeetingDto,
} from '@workflex/shared';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.schema';
import { ChatRealtime } from '../messaging/chat-realtime.service';
import { MessagingService } from '../messaging/messaging.service';
import { LivekitService } from './livekit.service';
import {
  expandOccurrences,
  isInCall,
  joinWindow,
  type Slot,
} from './meeting-schedule.util';

/** How many people the "invite without typing an ID" list offers. */
const CONTACT_LIMIT = 50;

/** A meeting that has just run over is still worth showing under Upcoming. */
const UPCOMING_GRACE_MS = 30 * 60_000;

/**
 * Meetings: scheduling, invitations, and the pass into the video room.
 *
 * Who may do what is decided here and nowhere else. Anyone can host and invite
 * — but only people they already deal with, or whose WorkFlex ID they typed in
 * full, and never someone who has blocked them. A guest gets a pass into the
 * room only if they are on the list, only at the right time, and only for
 * that one room.
 *
 * Invitations arrive in the guest's messages (as a direct message from the
 * host, live) and in their Meetings list. Video itself is LiveKit's job; see
 * LivekitService.
 */
@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly messaging: MessagingService,
    private readonly realtime: ChatRealtime,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // --- reading ---

  async list(userId: string, tab: MeetingTab): Promise<MeetingsOverview> {
    const now = new Date();
    const mine: Prisma.MeetingWhereInput = {
      OR: [{ hostId: userId }, { participants: { some: { userId } } }],
    };
    const upcoming: Prisma.MeetingWhereInput = {
      AND: [
        mine,
        { status: 'SCHEDULED', endsAt: { gte: new Date(now.getTime() - UPCOMING_GRACE_MS) } },
      ],
    };
    const past: Prisma.MeetingWhereInput = {
      AND: [
        mine,
        {
          OR: [
            { status: { in: ['ENDED', 'CANCELLED'] } },
            { endsAt: { lt: new Date(now.getTime() - UPCOMING_GRACE_MS) } },
          ],
        },
      ],
    };
    const organized: Prisma.MeetingWhereInput = { hostId: userId };

    const [rows, nUpcoming, nPast, nOrganized, nTemplates] = await Promise.all([
      this.prisma.meeting.findMany({
        where: tab === 'UPCOMING' ? upcoming : tab === 'PAST' ? past : organized,
        orderBy: { startsAt: tab === 'UPCOMING' ? 'asc' : 'desc' },
        take: 100,
        include: MEETING_INCLUDE,
      }),
      this.prisma.meeting.count({ where: upcoming }),
      this.prisma.meeting.count({ where: past }),
      this.prisma.meeting.count({ where: organized }),
      this.prisma.meetingTemplate.count({ where: { ownerId: userId } }),
    ]);

    return {
      meetings: rows.map((row) => this.toMeeting(row, userId, now)),
      counts: { upcoming: nUpcoming, past: nPast, organized: nOrganized, templates: nTemplates },
      callsEnabled: this.livekit.isConfigured(),
    };
  }

  async get(userId: string, id: string): Promise<Meeting> {
    return this.toMeeting(await this.mine(userId, id), userId, new Date());
  }

  /**
   * People the host can invite from a list: those they already have a thread
   * with, applicants to their jobs, the people whose jobs they applied to, and
   * anyone they have met with before. Everybody else has to be found by typing
   * their WorkFlex ID in full.
   */
  async contacts(userId: string): Promise<MeetingContacts> {
    const [threads, applicants, posters, hosted, attended] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { OR: [{ workerId: userId }, { recruiterId: userId }], blockedAt: null },
        orderBy: { lastMessageAt: 'desc' },
        take: 100,
        select: { workerId: true, recruiterId: true },
      }),
      this.prisma.jobApplication.findMany({
        where: { job: { postedBy: userId } },
        orderBy: { appliedAt: 'desc' },
        take: 100,
        select: { userId: true },
      }),
      this.prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { appliedAt: 'desc' },
        take: 100,
        select: { job: { select: { postedBy: true } } },
      }),
      this.prisma.meetingParticipant.findMany({
        where: { meeting: { hostId: userId }, userId: { not: userId } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { userId: true },
      }),
      this.prisma.meeting.findMany({
        where: { participants: { some: { userId } }, hostId: { not: userId } },
        orderBy: { startsAt: 'desc' },
        take: 100,
        select: { hostId: true },
      }),
    ]);

    // Most recent first, and each person once.
    const ordered: string[] = [];
    const add = (id: string | null | undefined) => {
      if (id && id !== userId && !ordered.includes(id)) ordered.push(id);
    };
    for (const t of threads) add(t.workerId === userId ? t.recruiterId : t.workerId);
    for (const h of hosted) add(h.userId);
    for (const a of attended) add(a.hostId);
    for (const a of applicants) add(a.userId);
    for (const p of posters) add(p.job.postedBy);

    const ids = ordered.slice(0, CONTACT_LIMIT);
    const people = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids }, status: 'ACTIVE' },
          select: PERSON,
        })
      : [];
    const byId = new Map(people.map((p) => [p.id, p]));

    return {
      contacts: ids.flatMap((id) => {
        const person = byId.get(id);
        return person ? [toPerson(person)] : [];
      }),
    };
  }

  // --- scheduling ---

  async schedule(userId: string, dto: ScheduleMeetingDto): Promise<Meeting> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const now = new Date();

    if (startsAt.getTime() < now.getTime() - MEETING_LIMITS.startGraceMinutes * 60_000) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That start time has already passed',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { fieldErrors: { startsAt: ['Pick a time that has not passed'] } },
      );
    }

    const guestIds = [...new Set(dto.participantIds)].filter((id) => id !== userId);
    if (guestIds.length > 0) {
      const found = await this.prisma.user.count({
        where: { id: { in: guestIds }, status: 'ACTIVE' },
      });
      if (found !== guestIds.length) {
        throw new AppException(
          ApiErrorCode.NOT_FOUND,
          'Someone you invited could not be found',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.assertNobodyBlocked(userId, guestIds);
    }

    let roomId: string | null = null;
    if (dto.kind === 'IN_PERSON' && dto.physicalRoomId) {
      const room = await this.prisma.physicalRoom.findFirst({
        where: { id: dto.physicalRoomId, ownerId: userId },
        select: { id: true },
      });
      if (!room) {
        throw new AppException(ApiErrorCode.NOT_FOUND, 'No such room', HttpStatus.NOT_FOUND);
      }
      roomId = room.id;
    }

    const slots = expandOccurrences({ startsAt, endsAt }, dto.recurrence, dto.repeatCount);
    if (roomId) for (const slot of slots) await this.assertRoomFree(roomId, slot);

    const seriesId = slots.length > 1 ? randomUUID() : null;
    const created = await this.prisma.$transaction(
      slots.map((slot) => {
        const id = randomUUID();
        return this.prisma.meeting.create({
          data: {
            id,
            title: dto.title,
            kind: dto.kind,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            agenda: dto.agenda || null,
            notes: dto.notes || null,
            recurrence: dto.recurrence,
            seriesId,
            hostId: userId,
            roomName: `wf-${id}`,
            physicalRoomId: roomId,
            participants: {
              create: [
                { userId, role: 'HOST', response: 'ACCEPTED' },
                ...guestIds.map((guestId) => ({ userId: guestId, role: 'GUEST' as const })),
              ],
            },
          },
          include: MEETING_INCLUDE,
        });
      }),
    );

    if (dto.saveAsTemplate) {
      await this.prisma.meetingTemplate.create({
        data: {
          ownerId: userId,
          name: dto.title,
          title: dto.title,
          kind: dto.kind,
          durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
          agenda: dto.agenda || null,
          notes: dto.notes || null,
          recurrence: dto.recurrence,
          repeatCount: dto.repeatCount,
          participantIds: guestIds,
          physicalRoomId: roomId,
        },
      });
    }

    const first = created[0]!;
    await this.invite(userId, first, guestIds, slots.length);
    this.announce(first, [userId, ...guestIds]);

    this.logger.log(`Meeting ${first.id} scheduled by ${userId} with ${guestIds.length} guest(s)`);
    return this.toMeeting(first, userId, now);
  }

  async respond(userId: string, id: string, response: MeetingResponse): Promise<Meeting> {
    const row = await this.mine(userId, id);
    if (row.hostId === userId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'You are hosting this meeting',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId: id, userId } },
      data: { response },
    });
    this.announce(row);
    return this.get(userId, id);
  }

  /** Cancels this meeting, or every meeting still to come in its series. Host only. */
  async cancel(userId: string, id: string, dto: CancelMeetingDto): Promise<Meeting> {
    const row = await this.hosted(userId, id);

    if (dto.scope === 'SERIES' && row.seriesId) {
      await this.prisma.meeting.updateMany({
        where: { seriesId: row.seriesId, status: 'SCHEDULED', startsAt: { gte: row.startsAt } },
        data: { status: 'CANCELLED' },
      });
    } else {
      await this.prisma.meeting.update({ where: { id }, data: { status: 'CANCELLED' } });
    }

    await this.tell(
      userId,
      row,
      `❌ Meeting cancelled: ${row.title}${dto.scope === 'SERIES' && row.seriesId ? ' (and the rest of the series)' : ''}.`,
    );
    this.announce(row);
    return this.get(userId, id);
  }

  /** Ends a meeting for everybody in it. Host only. */
  async end(userId: string, id: string): Promise<Meeting> {
    const row = await this.hosted(userId, id);
    if (row.status !== 'SCHEDULED') {
      throw new AppException(
        ApiErrorCode.MEETING_NOT_JOINABLE,
        'This meeting is already over',
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.meeting.update({ where: { id }, data: { status: 'ENDED' } }),
      this.prisma.meetingParticipant.updateMany({
        where: { meetingId: id, joinedAt: { not: null } },
        data: { leftAt: now },
      }),
    ]);
    await this.livekit.endRoom(row.roomName);

    this.announce(row);
    return this.get(userId, id);
  }

  // --- the room ---

  /** A pass into the video room, for somebody on the list, at the right time. */
  async join(userId: string, id: string): Promise<JoinMeetingResult> {
    const row = await this.mine(userId, id);
    const role: MeetingRole = row.hostId === userId ? 'HOST' : 'GUEST';

    if (row.kind !== 'VIDEO') {
      throw new AppException(
        ApiErrorCode.MEETING_NOT_JOINABLE,
        'This is an in-person meeting',
        HttpStatus.CONFLICT,
      );
    }
    if (row.status !== 'SCHEDULED') {
      throw new AppException(
        ApiErrorCode.MEETING_NOT_JOINABLE,
        row.status === 'CANCELLED' ? 'This meeting was cancelled' : 'This meeting has ended',
        HttpStatus.CONFLICT,
      );
    }

    const { opensAt, closesAt } = joinWindow(row, role);
    const now = new Date();
    if (now < opensAt || now > closesAt) {
      throw new AppException(
        ApiErrorCode.MEETING_NOT_JOINABLE,
        now < opensAt ? 'It is too early to join this meeting' : 'This meeting is over',
        HttpStatus.CONFLICT,
        { opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() },
      );
    }

    if (!this.livekit.isConfigured()) {
      throw new AppException(
        ApiErrorCode.CALLS_UNAVAILABLE,
        'Video calls are not set up on this server yet',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const me = row.participants.find((p) => p.userId === userId);
    const person = me?.user ?? row.host;
    const name = toPerson(person).name;

    const token = await this.livekit.tokenFor({
      room: row.roomName,
      identity: userId,
      name,
      metadata: JSON.stringify({ publicId: person.publicId, role }),
      // Until the door shuts, and never less than ten minutes or more than half a day.
      ttlSeconds: Math.min(12 * 3600, Math.max(600, Math.ceil((closesAt.getTime() - now.getTime()) / 1000))),
    });

    if (me) {
      await this.prisma.meetingParticipant.update({
        where: { id: me.id },
        data: {
          joinedAt: now,
          // Coming to the meeting is accepting it.
          ...(me.response === 'PENDING' ? { response: 'ACCEPTED' as const } : {}),
        },
      });
    }
    this.announce(row);

    const url = this.livekit.url()!;
    const params = new URLSearchParams({ u: url, t: token, m: id, n: row.title });
    return {
      url,
      token,
      roomName: row.roomName,
      identity: userId,
      name,
      title: row.title,
      // In the fragment, not the query: a fragment is never sent to a server.
      joinUrl: `${this.webUrl()}/meeting-room#${params.toString()}`,
    };
  }

  async leave(userId: string, id: string): Promise<void> {
    const row = await this.mine(userId, id);
    await this.prisma.meetingParticipant.updateMany({
      where: { meetingId: id, userId },
      data: { leftAt: new Date() },
    });
    this.announce(row);
  }

  /**
   * LiveKit's own notifications: somebody joined or left, a room closed. The
   * signature is the only authentication, so nothing is read from the body
   * before it has been checked.
   */
  async handleWebhook(rawBody: string, authorization: string | undefined): Promise<void> {
    if (!this.livekit.isConfigured()) return;

    let event;
    try {
      event = await this.livekit.receiver().receive(rawBody, authorization);
    } catch {
      throw AppException.unauthorized('Bad webhook signature');
    }

    const roomName = event.room?.name;
    if (!roomName) return;

    const meeting = await this.prisma.meeting.findUnique({
      where: { roomName },
      include: MEETING_INCLUDE,
    });
    if (!meeting) return;

    const now = new Date();
    const identity = event.participant?.identity;

    if (event.event === 'participant_joined' && identity) {
      await this.prisma.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, userId: identity },
        data: { joinedAt: now },
      });
    } else if (event.event === 'participant_left' && identity) {
      await this.prisma.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, userId: identity },
        data: { leftAt: now },
      });
    } else if (event.event === 'room_finished') {
      await this.prisma.meetingParticipant.updateMany({
        where: { meetingId: meeting.id, joinedAt: { not: null } },
        data: { leftAt: now },
      });
    } else {
      return;
    }
    this.announce(meeting);
  }

  // --- templates ---

  async templates(userId: string): Promise<MeetingTemplate[]> {
    const rows = await this.prisma.meetingTemplate.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const ids = [...new Set(rows.flatMap((row) => row.participantIds))];
    const people = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids }, status: 'ACTIVE' },
          select: PERSON,
        })
      : [];
    const byId = new Map(people.map((p) => [p.id, toPerson(p)]));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      kind: row.kind,
      durationMinutes: row.durationMinutes,
      agenda: row.agenda,
      notes: row.notes,
      recurrence: row.recurrence,
      repeatCount: row.repeatCount,
      // A guest whose account has since gone is left out, not shown stale.
      participants: row.participantIds.flatMap((id) => {
        const person = byId.get(id);
        return person ? [person] : [];
      }),
      physicalRoomId: row.physicalRoomId,
    }));
  }

  async deleteTemplate(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.meetingTemplate.deleteMany({
      where: { id, ownerId: userId },
    });
    if (count === 0) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such template', HttpStatus.NOT_FOUND);
    }
  }

  // --- physical rooms ---

  async rooms(userId: string): Promise<PhysicalRoom[]> {
    const rows = await this.prisma.physicalRoom.findMany({
      where: { ownerId: userId },
      orderBy: { name: 'asc' },
      take: 100,
    });
    return rows.map(toRoom);
  }

  async createRoom(userId: string, dto: CreateRoomDto): Promise<PhysicalRoom> {
    const count = await this.prisma.physicalRoom.count({ where: { ownerId: userId } });
    if (count >= 50) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'You can keep up to 50 rooms',
        HttpStatus.BAD_REQUEST,
      );
    }
    const row = await this.prisma.physicalRoom.create({
      data: {
        ownerId: userId,
        name: dto.name,
        location: dto.location || null,
        capacity: dto.capacity ?? null,
      },
    });
    return toRoom(row);
  }

  async deleteRoom(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.physicalRoom.deleteMany({ where: { id, ownerId: userId } });
    if (count === 0) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such room', HttpStatus.NOT_FOUND);
    }
  }

  // --- internals ---

  private async mine(userId: string, id: string): Promise<MeetingRow> {
    const row = await this.prisma.meeting.findFirst({
      where: { id, OR: [{ hostId: userId }, { participants: { some: { userId } } }] },
      include: MEETING_INCLUDE,
    });
    if (!row) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such meeting', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async hosted(userId: string, id: string): Promise<MeetingRow> {
    const row = await this.mine(userId, id);
    if (row.hostId !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the host can do that',
        HttpStatus.FORBIDDEN,
      );
    }
    return row;
  }

  /** Somebody who blocked the host is not invited, and is not told why. */
  private async assertNobodyBlocked(hostId: string, guestIds: string[]): Promise<void> {
    const blocked = await this.prisma.conversation.count({
      where: {
        blockedAt: { not: null },
        blockedBy: { in: guestIds },
        OR: [{ workerId: hostId }, { recruiterId: hostId }],
      },
    });
    if (blocked > 0) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'One of those people cannot be invited',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async assertRoomFree(roomId: string, slot: Slot): Promise<void> {
    const clash = await this.prisma.meeting.findFirst({
      where: {
        physicalRoomId: roomId,
        status: 'SCHEDULED',
        startsAt: { lt: slot.endsAt },
        endsAt: { gt: slot.startsAt },
      },
      select: { title: true },
    });
    if (clash) {
      throw new AppException(
        ApiErrorCode.ROOM_BUSY,
        `That room is already booked for "${clash.title}" at that time`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /** The invitation: a direct message from the host, live, with the meeting attached. */
  private async invite(
    hostId: string,
    meeting: MeetingRow,
    guestIds: string[],
    occurrences: number,
  ): Promise<void> {
    const minutes = Math.round((meeting.endsAt.getTime() - meeting.startsAt.getTime()) / 60_000);
    const repeats =
      occurrences > 1
        ? ` Repeats ${meeting.recurrence.toLowerCase()}, ${occurrences} times in all.`
        : '';
    const body =
      `📅 Meeting invitation: ${meeting.title} — ${whenInDhaka(meeting.startsAt)} (${minutes} min).` +
      `${repeats} Open Meetings to accept and join.`;
    await this.sendToAll(hostId, guestIds, {
      body,
      payload: {
        meetingId: meeting.id,
        title: meeting.title,
        startsAt: meeting.startsAt.toISOString(),
        endsAt: meeting.endsAt.toISOString(),
      },
    });
  }

  private async tell(hostId: string, meeting: MeetingRow, body: string): Promise<void> {
    const guestIds = meeting.participants.filter((p) => p.userId !== hostId).map((p) => p.userId);
    await this.sendToAll(hostId, guestIds, { body, payload: { meetingId: meeting.id } });
  }

  /**
   * One message to each guest. A guest who cannot be reached this way — the
   * thread was blocked, say — simply does not get the message; the meeting is
   * on their list all the same.
   */
  private async sendToAll(
    hostId: string,
    guestIds: string[],
    message: { body: string; payload: Record<string, unknown> },
  ): Promise<void> {
    await Promise.allSettled(
      guestIds.map(async (guestId) => {
        const thread = await this.messaging.openDirect(hostId, guestId);
        await this.messaging.send(hostId, thread.id, {
          kind: 'INTERVIEW',
          body: message.body,
          payload: message.payload,
        });
      }),
    ).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.warn(`Meeting message not delivered — ${(result.reason as Error).message}`);
        }
      }
    });
  }

  /** Tells everybody on the meeting to refresh their list. */
  private announce(meeting: { id: string; hostId: string; participants: { userId: string }[] }, extra: string[] = []): void {
    const people = new Set([meeting.hostId, ...meeting.participants.map((p) => p.userId), ...extra]);
    this.realtime.emit([...people], 'meeting:changed', { meetingId: meeting.id });
  }

  private webUrl(): string {
    const explicit = this.config.get('WEB_APP_URL', { infer: true });
    const origins = (this.config.get('APP_WEB_ORIGINS', { infer: true }) ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    return (explicit || origins[0] || 'http://localhost:8081').replace(/\/+$/, '');
  }

  private toMeeting(row: MeetingRow, userId: string, now: Date): Meeting {
    const role: MeetingRole = row.hostId === userId ? 'HOST' : 'GUEST';
    const { opensAt, closesAt } = joinWindow(row, role);
    const me = row.participants.find((p) => p.userId === userId);

    const participants: MeetingParticipant[] = row.participants.map((p) => ({
      ...toPerson(p.user),
      role: p.role,
      response: p.response,
      inCall: isInCall(p, now),
    }));

    return {
      id: row.id,
      seriesId: row.seriesId,
      title: row.title,
      kind: row.kind,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      agenda: row.agenda,
      notes: row.notes,
      status: row.status,
      recurrence: row.recurrence,
      live: participants.some((p) => p.inCall),
      canJoin:
        row.kind === 'VIDEO' && row.status === 'SCHEDULED' && now >= opensAt && now <= closesAt,
      joinOpensAt: opensAt.toISOString(),
      iAmHost: role === 'HOST',
      myResponse: role === 'HOST' ? null : (me?.response ?? null),
      host: toPerson(row.host),
      participants,
      room: row.physicalRoom ? toRoom(row.physicalRoom) : null,
      link: `${this.webUrl()}/meeting-room?m=${row.id}`,
    };
  }
}

// --- shapes ---

const PERSON = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  verificationLevel: true,
  company: { select: { name: true } },
} satisfies Prisma.UserSelect;

const MEETING_INCLUDE = {
  host: { select: PERSON },
  participants: { include: { user: { select: PERSON } }, orderBy: { createdAt: 'asc' } },
  physicalRoom: true,
} satisfies Prisma.MeetingInclude;

type MeetingRow = Prisma.MeetingGetPayload<{ include: typeof MEETING_INCLUDE }>;
type PersonRow = Prisma.UserGetPayload<{ select: typeof PERSON }>;

/** Never the phone number: a name, or the WorkFlex ID when there is no name. */
function toPerson(person: PersonRow): MeetingPerson {
  return {
    id: person.id,
    publicId: person.publicId,
    name: [person.firstName, person.lastName].filter(Boolean).join(' ') || person.publicId,
    company: person.company?.name ?? null,
    verified: person.verificationLevel >= 1,
  };
}

function toRoom(row: { id: string; name: string; location: string | null; capacity: number | null }): PhysicalRoom {
  return { id: row.id, name: row.name, location: row.location, capacity: row.capacity };
}

/** "Wed 30 Sep, 3:33 AM (Dhaka time)" — the market this is built for. */
function whenInDhaka(date: Date): string {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${text} (Dhaka time)`;
}
