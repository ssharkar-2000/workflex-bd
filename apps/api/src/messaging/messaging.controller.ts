import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  directLookupSchema,
  inboxFilterSchema,
  sendMessageSchema,
  startConversationSchema,
  type DirectLookupDto,
  type SendMessageDto,
  type StartConversationDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MessagingService } from './messaging.service';

const inboxQuerySchema = z.object({
  filter: inboxFilterSchema.default('ALL'),
  search: z.string().trim().max(80).optional(),
});
type InboxQuery = z.output<typeof inboxQuerySchema>;

const threadQuerySchema = z.object({ before: z.string().datetime().optional() });
type ThreadQuery = z.output<typeof threadQuerySchema>;

const flagSchema = z.object({ on: z.boolean() });
type FlagDto = z.output<typeof flagSchema>;

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'The inbox, with the section counts and unread total' })
  async inbox(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(inboxQuerySchema)) query: InboxQuery,
  ) {
    return this.messaging.inbox(userId, query.filter, query.search);
  }

  /**
   * Two path segments, so it can never be mistaken for `:id` below. Throttled
   * harder than the rest: an exact-id lookup is only a directory if it can
   * be asked fast enough to guess ids.
   */
  @Get('people/:publicId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Who a WorkFlex id belongs to, before messaging them (exact match)' })
  async lookup(
    @CurrentUser('userId') userId: string,
    @Param(new ZodValidationPipe(directLookupSchema)) params: DirectLookupDto,
  ) {
    return this.messaging.lookup(userId, params.publicId);
  }

  @Post('direct')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Open the direct thread with the owner of a WorkFlex id, or reopen it' })
  async startDirect(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(directLookupSchema)) dto: DirectLookupDto,
  ) {
    return this.messaging.startDirect(userId, dto.publicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One thread. Opening it marks it read.' })
  async thread(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(threadQuerySchema)) query: ThreadQuery,
  ) {
    return this.messaging.thread(userId, id, query.before);
  }

  @Post()
  @ApiOperation({ summary: 'Start a thread about a job, or reopen the existing one' })
  async start(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(startConversationSchema)) dto: StartConversationDto,
  ) {
    return this.messaging.start(userId, dto);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message' })
  async send(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
  ) {
    return this.messaging.send(userId, id, dto);
  }

  /** For when the chat socket is down: the socket's `conversation:read` does the same. */
  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark a thread read up to its newest message' })
  async read(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.messaging.markRead(userId, id);
  }

  @Post(':id/mute')
  @ApiOperation({ summary: 'Stop a thread notifying, without leaving it' })
  async mute(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(flagSchema)) dto: FlagDto,
  ) {
    return this.messaging.mute(userId, id, dto.on);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Close a thread to new messages, or open it again' })
  async block(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(flagSchema)) dto: FlagDto,
  ) {
    return this.messaging.block(userId, id, dto.on);
  }
}
