import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { ChatClientEvents, ChatServerEvents } from '@workflex/shared';

/** What the gateway stores on each socket once its token checks out. */
export interface ChatSocketData {
  userId: string;
}

export type ChatNamespace = Namespace<ChatClientEvents, ChatServerEvents, object, ChatSocketData>;

/** Every socket a person has open joins this room — one per phone or tab. */
export function roomFor(userId: string): string {
  return `user:${userId}`;
}

/**
 * The chat socket as the rest of the API sees it: who is connected, and a
 * way to reach them.
 *
 * Kept apart from the gateway so MessagingService can push an event without
 * depending on the gateway, which itself depends on MessagingService.
 *
 * Presence lives in memory, so it is per process. A single API instance —
 * which is how this deploys — sees everyone. Running several would need the
 * Socket.IO Redis adapter for the rooms and a shared store in place of the
 * map below.
 */
@Injectable()
export class ChatRealtime {
  private server: ChatNamespace | null = null;

  /** userId → ids of that person's open sockets. */
  private readonly sockets = new Map<string, Set<string>>();

  attach(server: ChatNamespace): void {
    this.server = server;
  }

  /** True when this is the person's first open socket: they just came online. */
  connected(userId: string, socketId: string): boolean {
    const open = this.sockets.get(userId) ?? new Set<string>();
    const first = open.size === 0;
    open.add(socketId);
    this.sockets.set(userId, open);
    return first;
  }

  /** True when that was their last open socket: they just went offline. */
  disconnected(userId: string, socketId: string): boolean {
    const open = this.sockets.get(userId);
    if (!open) return false;
    open.delete(socketId);
    if (open.size > 0) return false;
    this.sockets.delete(userId);
    return true;
  }

  isOnline(userId: string): boolean {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  /**
   * Send an event to everyone listed, on every device they have open.
   * Nobody connected is not an error: they will read it from the inbox.
   */
  emit<E extends keyof ChatServerEvents>(
    userIds: string | string[],
    event: E,
    ...args: Parameters<ChatServerEvents[E]>
  ): void {
    const rooms = (Array.isArray(userIds) ? userIds : [userIds]).map(roomFor);
    if (!this.server || rooms.length === 0) return;
    // Socket.IO's own typing of emit cannot follow a generic event name.
    (this.server.to(rooms).emit as (event: string, ...payload: unknown[]) => boolean)(
      event,
      ...args,
    );
  }
}
