import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { ApiErrorCode, type GoogleStatus } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';
import { isAllowedReturnUrl, parseWebOrigins } from '../wallet/return-url';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * The narrowest scopes that do the job. `calendar.events` creates, moves and
 * deletes events on the recruiter's own calendar — which is what a Meet link
 * hangs off — and nothing more: it cannot read their other calendars, their
 * mail or their contacts.
 */
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

/** How long somebody has between tapping Connect and finishing on Google. */
const STATE_TTL_MS = 10 * 60_000;

export type MeetingInput = {
  interviewId: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
};

/**
 * Google Meet, on the recruiter's own Google account.
 *
 * ## Why their account and not the platform's
 *
 * Meet links can only be created by a Google account. A single platform
 * account would need a paid Workspace subscription and would own every
 * interview room in the country. Letting each recruiter connect their own —
 * a free Gmail is enough — means the room is theirs, it sits on their own
 * calendar at the right time, and nothing about it depends on WorkFlex BD
 * paying anybody.
 *
 * ## What is and is not shared with Google
 *
 * The event carries the job title and the time. It deliberately carries **no
 * attendee**: the candidate's email is not given to the recruiter's calendar,
 * because this platform does not show a candidate's contact details to an
 * employer before they are hired, and a calendar invite would do exactly
 * that. The candidate receives the link through the app's own message
 * thread instead, and joins by knocking — the recruiter admits them, which
 * is also the safer way into a room.
 *
 * ## Credentials
 *
 * Only the refresh token is stored, encrypted with AES-256-GCM under a key
 * derived from the server's own secret. Access tokens are fetched when needed
 * and never written anywhere.
 */
@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly redirectUri: string;
  private readonly key: Buffer;
  private readonly production: boolean;
  private readonly webOrigins: string[];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.clientId = config.get('GOOGLE_CLIENT_ID', { infer: true }) ?? null;
    this.clientSecret = config.get('GOOGLE_CLIENT_SECRET', { infer: true }) ?? null;

    const apiBase =
      config.get('API_PUBLIC_URL', { infer: true }) ??
      `http://localhost:${config.get('PORT', { infer: true })}/api/v1`;
    this.redirectUri =
      config.get('GOOGLE_REDIRECT_URI', { infer: true }) ??
      `${apiBase.replace(/\/+$/, '')}/google/callback`;

    // A key of its own, derived rather than configured: one fewer secret to
    // manage, and HKDF with a distinct label means it is not the JWT key even
    // though it starts from it.
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        config.get('JWT_ACCESS_SECRET', { infer: true }),
        'workflex-google',
        'google-refresh-token-v1',
        32,
      ),
    );

    this.production = config.get('NODE_ENV', { infer: true }) === 'production';
    this.webOrigins = parseWebOrigins(config.get('APP_WEB_ORIGINS', { infer: true }));

    this.logger.log(
      this.configured
        ? `Google Meet on — redirect URI ${this.redirectUri}`
        : 'Google Meet off — video interviews will use Jitsi rooms',
    );
  }

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async status(userId: string): Promise<GoogleStatus> {
    if (!this.configured) return { configured: false, connected: false, email: null };
    const row = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { googleEmail: true },
    });
    return { configured: true, connected: Boolean(row), email: row?.googleEmail ?? null };
  }

  // --- connecting ---

  /** The Google consent page, carrying a signed note of who asked. */
  connectUrl(userId: string, returnTo: string): string {
    this.requireConfigured();
    if (!isAllowedReturnUrl(returnTo, { production: this.production, webOrigins: this.webOrigins })) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That return address is not this app',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', this.clientId!);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(' '));
    // offline + consent: the only combination that reliably returns a refresh
    // token, which is the whole point — without it the link dies in an hour.
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', this.signState({ userId, returnTo }));
    return url.toString();
  }

  /**
   * Where Google sends the browser back.
   *
   * Unauthenticated by necessity — Google's redirect carries no bearer token
   * — so who this is comes from the signed state, and only from there. A
   * state that fails its signature, or is more than ten minutes old, is
   * refused; the code in the URL is worthless without it.
   *
   * Returns the address to send the browser to, success or not, so the
   * person always lands back in the app rather than on an API error page.
   */
  async finishConnect(code: string | undefined, state: string | undefined, denied?: string) {
    const parsed = state ? this.verifyState(state) : null;
    const back = (outcome: string) => {
      const target = new URL(parsed?.returnTo ?? 'workflex://interviews');
      target.searchParams.set('google', outcome);
      return target.toString();
    };

    if (!parsed) return back('expired');
    if (denied || !code) return back('denied');
    this.requireConfigured();

    try {
      const tokens = await this.post(TOKEN_URL, {
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      });

      if (!tokens.refresh_token) {
        // Happens when the account had already granted access and Google
        // chose not to issue another. `prompt=consent` should prevent it;
        // if it happens anyway the person is asked to remove the app from
        // their Google account and connect again, rather than being left
        // connected to something that stops working in an hour.
        this.logger.warn(`Google returned no refresh token for user ${parsed.userId}`);
        return back('no-refresh');
      }

      const email = emailFromIdToken(tokens.id_token) ?? 'Google account';

      await this.prisma.googleConnection.upsert({
        where: { userId: parsed.userId },
        create: {
          userId: parsed.userId,
          googleEmail: email,
          refreshToken: this.encrypt(tokens.refresh_token),
          scope: tokens.scope ?? SCOPES.join(' '),
        },
        update: {
          googleEmail: email,
          refreshToken: this.encrypt(tokens.refresh_token),
          scope: tokens.scope ?? SCOPES.join(' '),
        },
      });

      this.logger.log(`Google connected for user ${parsed.userId}`);
      return back('connected');
    } catch (err) {
      this.logger.error(
        `Google connect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return back('error');
    }
  }

  /** Forget the account, and tell Google to forget us too. */
  async disconnect(userId: string): Promise<GoogleStatus> {
    const row = await this.prisma.googleConnection.findUnique({ where: { userId } });
    if (row) {
      try {
        const token = this.decrypt(row.refreshToken);
        await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
      } catch (err) {
        // Revoking is courtesy; deleting our copy is the part that matters.
        this.logger.warn(`Google revoke failed: ${err instanceof Error ? err.message : err}`);
      }
      await this.prisma.googleConnection.delete({ where: { userId } });
    }
    return this.status(userId);
  }

  // --- meetings ---

  /**
   * A calendar event with a Meet room on it, or null.
   *
   * Null — never a throw — when Google is not set up, the recruiter has not
   * connected, or Google fails. Scheduling an interview must not depend on a
   * third party being up; the caller falls back to a Jitsi room.
   */
  async createMeeting(
    userId: string,
    input: MeetingInput,
  ): Promise<{ url: string; eventId: string } | null> {
    const access = await this.accessTokenFor(userId);
    if (!access) return null;

    try {
      const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
      const res = await fetch(`${CALENDAR}?conferenceDataVersion=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: input.title,
          description: input.description,
          start: { dateTime: input.startsAt.toISOString() },
          end: { dateTime: endsAt.toISOString() },
          // No attendees — see the class note on what is shared with Google.
          conferenceData: {
            createRequest: {
              // The interview id makes the request idempotent: a retry after
              // a timeout gets the same room rather than a second one.
              requestId: input.interviewId,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`Calendar ${res.status}: ${await res.text()}`);

      let event = (await res.json()) as CalendarEvent;

      // Google sometimes creates the room a moment after the event, and says
      // so with a "pending" status. One short wait covers it in practice.
      if (!event.hangoutLink && event.conferenceData?.createRequest?.status?.statusCode === 'pending') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const again = await fetch(`${CALENDAR}/${event.id}`, {
          headers: { Authorization: `Bearer ${access}` },
        });
        if (again.ok) event = (await again.json()) as CalendarEvent;
      }

      if (!event.hangoutLink) throw new Error('Google created the event but no Meet room');
      return { url: event.hangoutLink, eventId: event.id };
    } catch (err) {
      this.logger.error(
        `Meet creation failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** Move the event with the interview. Failure is logged, not thrown. */
  async moveMeeting(userId: string, eventId: string, startsAt: Date, durationMinutes: number) {
    const access = await this.accessTokenFor(userId);
    if (!access) return;
    try {
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      const res = await fetch(`${CALENDAR}/${eventId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { dateTime: startsAt.toISOString() },
          end: { dateTime: endsAt.toISOString() },
        }),
      });
      if (!res.ok) throw new Error(`Calendar ${res.status}`);
    } catch (err) {
      this.logger.warn(`Meet move failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Remove the event when the interview is called off. */
  async cancelMeeting(userId: string, eventId: string) {
    const access = await this.accessTokenFor(userId);
    if (!access) return;
    try {
      const res = await fetch(`${CALENDAR}/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${access}` },
      });
      // 410 is "already gone", which is the state we wanted.
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        throw new Error(`Calendar ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Meet cancel failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // --- tokens ---

  /**
   * A fresh access token for this recruiter, or null.
   *
   * A refresh token Google rejects as invalid means the person revoked access
   * from their Google account. The stored copy is then deleted, so the app
   * shows them as disconnected instead of failing every interview quietly.
   */
  private async accessTokenFor(userId: string): Promise<string | null> {
    if (!this.configured) return null;
    const row = await this.prisma.googleConnection.findUnique({ where: { userId } });
    if (!row) return null;

    try {
      const tokens = await this.post(TOKEN_URL, {
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        refresh_token: this.decrypt(row.refreshToken),
        grant_type: 'refresh_token',
      });
      return tokens.access_token ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('invalid_grant')) {
        await this.prisma.googleConnection.delete({ where: { userId } }).catch(() => {});
        this.logger.warn(`Google access revoked by user ${userId}; connection removed`);
      } else {
        this.logger.error(`Google token refresh failed: ${message}`);
      }
      return null;
    }
  }

  private async post(url: string, form: Record<string, string>): Promise<TokenResponse> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const body = (await res.json()) as TokenResponse & { error?: string };
    if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body;
  }

  private requireConfigured(): void {
    if (!this.configured) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'Google Meet is not set up on this server',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // --- crypto ---

  /** AES-256-GCM: confidentiality and tamper detection in one step. */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
  }

  decrypt(sealed: string): string {
    const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !data) throw new Error('Malformed sealed token');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /**
   * The OAuth state: who asked, where to go back to, and until when.
   *
   * HMAC-signed rather than stored. It is what stops somebody else's Google
   * account being attached to your WorkFlex account — the classic OAuth
   * login-CSRF — and signing it means there is no table of pending requests
   * to clean up.
   */
  signState(payload: { userId: string; returnTo: string }): string {
    const body = Buffer.from(
      JSON.stringify({ ...payload, n: randomBytes(8).toString('hex'), e: Date.now() + STATE_TTL_MS }),
    ).toString('base64url');
    const mac = createHmac('sha256', this.key).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  verifyState(state: string): { userId: string; returnTo: string } | null {
    const [body, mac] = state.split('.');
    if (!body || !mac) return null;

    const expected = createHmac('sha256', this.key).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
        userId?: string;
        returnTo?: string;
        e?: number;
      };
      if (!parsed.userId || !parsed.returnTo || !parsed.e || parsed.e < Date.now()) return null;
      return { userId: parsed.userId, returnTo: parsed.returnTo };
    } catch {
      return null;
    }
  }
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  expires_in?: number;
};

type CalendarEvent = {
  id: string;
  hangoutLink?: string;
  conferenceData?: { createRequest?: { status?: { statusCode?: string } } };
};

/**
 * The email in the ID token Google returned alongside the access token.
 *
 * Read without verifying the signature, which is correct here and only here:
 * Google's own guidance is that a token received directly from its token
 * endpoint over HTTPS needs no further validation — nobody in between could
 * have written it.
 */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}
