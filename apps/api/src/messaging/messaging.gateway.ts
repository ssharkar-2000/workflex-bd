import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { z } from 'zod';
import {
  CHAT_SOCKET_NAMESPACE,
  CHAT_SOCKET_PATH,
  accessTokenPayloadSchema,
  type ChatClientEvents,
  type ChatServerEvents,
} from '@workflex/shared';
import type { Env } from '../config/env.schema';
import {
  ChatRealtime,
  roomFor,
  type ChatNamespace,
  type ChatSocketData,
} from './chat-realtime.service';
import { MessagingService } from './messaging.service';

type ChatSocket = Socket<ChatClientEvents, ChatServerEvents, object, ChatSocketData>;

const readSchema = z.object({ conversationId: z.string().uuid() });
const typingSchema = z.object({ conversationId: z.string().uuid(), typing: z.boolean() });

/** Events one socket may send in RATE_WINDOW_MS before the rest are dropped. */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 10_000;

/**
 * The live half of messaging, over Socket.IO.
 *
 * Messages are still sent over HTTP — the same endpoint, validation and
 * throttling as before — and this pushes them to whoever should see them the
 * moment they are stored. What travels only over the socket is what is not
 * worth a request: "I am reading this thread", "I am typing", "I am here".
 *
 * The app's global guards do not run on gateways, so the socket proves who
 * it is itself: the same access token as the HTTP API, checked in the
 * handshake before the connection is accepted. An expired token is refused
 * with "unauthorized", which is the app's cue to refresh it and reconnect.
 */
@WebSocketGateway({ namespace: CHAT_SOCKET_NAMESPACE, path: CHAT_SOCKET_PATH })
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);
  private readonly rates = new WeakMap<ChatSocket, { since: number; count: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly realtime: ChatRealtime,
    private readonly messaging: MessagingService,
  ) {}

  afterInit(server: ChatNamespace): void {
    this.realtime.attach(server);

    server.use((socket, next) => {
      this.authenticate(socket).then(
        (userId) => {
          socket.data.userId = userId;
          next();
        },
        () => next(new Error('unauthorized')),
      );
    });
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const { userId } = socket.data;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    await socket.join(roomFor(userId));
    if (this.realtime.connected(userId, socket.id)) void this.announce(userId, true);
  }

  handleDisconnect(socket: ChatSocket): void {
    const { userId } = socket.data;
    if (!userId) return;
    if (this.realtime.disconnected(userId, socket.id)) void this.announce(userId, false);
  }

  /** The thread is on screen: everything in it has been seen. */
  @SubscribeMessage('conversation:read')
  async read(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean }> {
    const parsed = readSchema.safeParse(body);
    if (!parsed.success || !this.allow(socket)) return { ok: false };

    try {
      await this.messaging.markRead(socket.data.userId, parsed.data.conversationId);
      return { ok: true };
    } catch {
      // Not their thread, or it no longer exists. Nothing to tell them.
      return { ok: false };
    }
  }

  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<void> {
    const parsed = typingSchema.safeParse(body);
    if (!parsed.success || !this.allow(socket)) return;

    const { userId } = socket.data;
    const other = await this.messaging.otherParticipant(userId, parsed.data.conversationId);
    if (!other) return;

    this.realtime.emit(other, 'typing', {
      conversationId: parsed.data.conversationId,
      userId,
      typing: parsed.data.typing,
    });
  }

  // --- internals ---

  private async authenticate(socket: ChatSocket): Promise<string> {
    const fromAuth: unknown = socket.handshake.auth?.token;
    const header = socket.handshake.headers.authorization;
    const token =
      typeof fromAuth === 'string'
        ? fromAuth
        : header?.startsWith('Bearer ')
          ? header.slice('Bearer '.length)
          : null;
    if (!token) throw new Error('No token');

    const raw = await this.jwt.verifyAsync(token.trim(), {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
    return accessTokenPayloadSchema.parse(raw).sub;
  }

  /** Online and offline go only to people who share a thread with them. */
  private async announce(userId: string, online: boolean): Promise<void> {
    try {
      const people = await this.messaging.correspondentsOf(userId);
      this.realtime.emit(people, 'presence', { userId, online });
    } catch (err) {
      this.logger.warn(`Presence for ${userId} not sent — ${(err as Error).message}`);
    }
  }

  /** A crude per-socket limit: enough for any person, not for a script. */
  private allow(socket: ChatSocket): boolean {
    const now = Date.now();
    const rate = this.rates.get(socket);
    if (!rate || now - rate.since > RATE_WINDOW_MS) {
      this.rates.set(socket, { since: now, count: 1 });
      return true;
    }
    rate.count += 1;
    return rate.count <= RATE_LIMIT;
  }
}
