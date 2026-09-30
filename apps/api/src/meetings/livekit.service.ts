import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import type { Env } from '../config/env.schema';

/**
 * LiveKit, from the server's side.
 *
 * The server never touches audio or video. It does three small things: hands a
 * signed pass to somebody who is allowed into a room, closes a room when the
 * host ends the meeting, and checks the signature on LiveKit's own
 * notifications. The API secret that signs passes stays here; the apps only
 * ever see the finished pass.
 */
@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** All three settings present. Without them meetings still schedule, but nobody can join. */
  isConfigured(): boolean {
    return Boolean(this.url() && this.key() && this.secret());
  }

  /** The address the apps connect to (ws:// or wss://). */
  url(): string | undefined {
    return this.config.get('LIVEKIT_URL', { infer: true }) || undefined;
  }

  /**
   * A pass into one room for one person.
   *
   * Good for `ttlSeconds` and no longer, and only for this room: a leaked pass
   * opens one meeting for a while, not the account.
   */
  async tokenFor(input: {
    room: string;
    identity: string;
    name: string;
    metadata?: string;
    ttlSeconds: number;
  }): Promise<string> {
    const token = new AccessToken(this.key()!, this.secret()!, {
      identity: input.identity,
      name: input.name,
      metadata: input.metadata,
      ttl: input.ttlSeconds,
    });
    token.addGrant({
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      // In-call chat travels as data messages.
      canPublishData: true,
    });
    return token.toJwt();
  }

  /** Closes the room and sends everybody in it out. A room that is not there is fine. */
  async endRoom(room: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      await new RoomServiceClient(this.httpUrl(), this.key()!, this.secret()!).deleteRoom(room);
    } catch (err) {
      this.logger.warn(`Could not close room ${room} — ${(err as Error).message}`);
    }
  }

  /** Verifies a notification from LiveKit against the API secret. */
  receiver(): WebhookReceiver {
    return new WebhookReceiver(this.key()!, this.secret()!);
  }

  /** The same server over HTTP, which is what the management API speaks. */
  private httpUrl(): string {
    return this.url()!.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  }

  private key(): string | undefined {
    return this.config.get('LIVEKIT_API_KEY', { infer: true }) || undefined;
  }

  private secret(): string | undefined {
    return this.config.get('LIVEKIT_API_SECRET', { infer: true }) || undefined;
  }
}
