import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notices addressed to the signed-in account' })
  async feed(@CurrentUser('userId') userId: string) {
    return this.notifications.feed(userId);
  }

  /**
   * Split from the feed so the dashboard bell can poll something cheap. The
   * full list is only fetched when someone actually opens the screen.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Number badged on the bell' })
  async unread(@CurrentUser('userId') userId: string) {
    return { unreadCount: await this.notifications.unreadCount(userId) };
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark every visible notice as read' })
  async readAll(@CurrentUser('userId') userId: string): Promise<void> {
    await this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark one notice as read' })
  async read(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notifications.markRead(userId, id);
  }
}
