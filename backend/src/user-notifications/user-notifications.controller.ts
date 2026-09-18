import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserNotificationsReadService } from './user-notifications-read.service';

/**
 * Read side of the user-facing message log (items 7, 8, 9, 10, 12).
 *
 * `/user-notifications` (admin session required) is the outbox: what the
 * platform has told users and whether they have read it, so an admin can
 * prove a 24-hour ban notice actually went out.
 *
 * `/user-notifications/inbox` is the user's own feed and is deliberately
 * outside the admin guard — it is what the user's app polls, and what drives
 * the instant popup in item 9. It only ever returns rows addressed to the id
 * passed in, so one user can't read another's messages.
 */
@Controller('user-notifications')
export class UserNotificationsController {
  constructor(private readonly messages: UserNotificationsReadService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  outbox(
    @Query('workerId') workerId?: string,
    @Query('employerId') employerId?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.outbox({ workerId, employerId, kind, limit: Number(limit) || 50 });
  }

  @Get('inbox')
  inbox(
    @Query('workerId') workerId?: string,
    @Query('employerId') employerId?: string,
    @Query('since') since?: string,
  ) {
    return this.messages.inbox({ workerId, employerId, since });
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.messages.markRead(id);
  }
}
