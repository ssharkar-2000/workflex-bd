import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  cancelMeetingSchema,
  createRoomSchema,
  meetingTabSchema,
  respondMeetingSchema,
  scheduleMeetingSchema,
  type CancelMeetingDto,
  type CreateRoomDto,
  type RespondMeetingDto,
  type ScheduleMeetingDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MeetingsService } from './meetings.service';

const listQuerySchema = z.object({ tab: meetingTabSchema.default('UPCOMING') });
type ListQuery = z.output<typeof listQuerySchema>;

/**
 * Routes with a fixed word in them (contacts, templates, rooms) come before
 * the `:id` ones, or Nest would take the word for an id.
 */
@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: 'My meetings for one tab, with the counts for all of them' })
  list(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.meetings.list(userId, query.tab);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'People I can invite without typing an ID' })
  contacts(@CurrentUser('userId') userId: string) {
    return this.meetings.contacts(userId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'My saved meeting templates' })
  templates(@CurrentUser('userId') userId: string) {
    return this.meetings.templates(userId);
  }

  @Delete('templates/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a template' })
  async deleteTemplate(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.meetings.deleteTemplate(userId, id);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'My physical rooms' })
  rooms(@CurrentUser('userId') userId: string) {
    return this.meetings.rooms(userId);
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Add a physical room' })
  createRoom(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createRoomSchema)) dto: CreateRoomDto,
  ) {
    return this.meetings.createRoom(userId, dto);
  }

  @Delete('rooms/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a physical room' })
  async deleteRoom(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.meetings.deleteRoom(userId, id);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Schedule a meeting and invite people' })
  schedule(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(scheduleMeetingSchema)) dto: ScheduleMeetingDto,
  ) {
    return this.meetings.schedule(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One meeting' })
  get(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.get(userId, id);
  }

  @Post(':id/join')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'A pass into the video room, for someone on the list at the right time' })
  join(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.join(userId, id);
  }

  @Post(':id/leave')
  @HttpCode(204)
  @ApiOperation({ summary: 'Say I have left the call' })
  async leave(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.meetings.leave(userId, id);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or decline an invitation' })
  respond(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(respondMeetingSchema)) dto: RespondMeetingDto,
  ) {
    return this.meetings.respond(userId, id, dto.response);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a meeting (host only), or the rest of its series' })
  cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cancelMeetingSchema)) dto: CancelMeetingDto,
  ) {
    return this.meetings.cancel(userId, id, dto);
  }

  @Post(':id/end')
  @HttpCode(200)
  @ApiOperation({ summary: 'End a meeting for everybody (host only)' })
  end(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.end(userId, id);
  }
}
