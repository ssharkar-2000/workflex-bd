import { Body, Controller, Delete, Get, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { googleConnectSchema, type GoogleConnectDto } from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GoogleService } from './google.service';

@ApiTags('google')
@Controller('google')
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether Google Meet is available and connected' })
  async status(@CurrentUser('userId') userId: string) {
    return this.google.status(userId);
  }

  @Post('connect')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The Google consent page to send the recruiter to' })
  connect(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(googleConnectSchema)) dto: GoogleConnectDto,
  ) {
    return { url: this.google.connectUrl(userId, dto.returnTo) };
  }

  /**
   * Google's redirect lands here.
   *
   * Public by necessity: Google sends the browser without our bearer token.
   * Identity comes from the signed state instead — see GoogleService — and
   * every outcome, including failure, redirects back into the app rather
   * than leaving the person on a JSON error from an API they never meant to
   * visit.
   */
  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'OAuth return from Google (browser redirect)' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const target = await this.google.finishConnect(code, state, error);
    res.redirect(302, target);
  }

  @Delete()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google and revoke access' })
  async disconnect(@CurrentUser('userId') userId: string) {
    return this.google.disconnect(userId);
  }
}
