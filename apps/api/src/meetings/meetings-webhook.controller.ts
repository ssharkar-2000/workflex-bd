import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MeetingsService } from './meetings.service';

/**
 * LiveKit calls this when somebody joins or leaves a room.
 *
 * Public and unthrottled on purpose: LiveKit is not a signed-in user, and the
 * request proves who it is with a signature over the exact bytes it sent — see
 * MeetingsService.handleWebhook. Those bytes arrive as
 * `application/webhook+json`, which the app's JSON parser leaves alone, so the
 * body is read here as it came.
 */
@ApiExcludeController()
@Controller('meetings/livekit')
export class MeetingsWebhookController {
  constructor(private readonly meetings: MeetingsService) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request,
    @Headers('authorization') authorization?: string,
  ): Promise<{ ok: true }> {
    await this.meetings.handleWebhook(await readRawBody(req), authorization);
    return { ok: true };
  }
}

function readRawBody(req: Request): Promise<string> {
  return new Promise((resolve, reject) => {
    // Something already read it (a JSON parser): that is all there is left.
    if (req.readableEnded) {
      resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
