import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  cancelInterviewSchema,
  completeInterviewSchema,
  interviewFilterSchema,
  interviewSideSchema,
  joinInterviewSchema,
  rescheduleInterviewSchema,
  respondToInterviewSchema,
  scheduleInterviewSchema,
  type CancelInterviewDto,
  type CompleteInterviewDto,
  type RescheduleInterviewDto,
  type JoinInterviewDto,
  type RespondToInterviewDto,
  type ScheduleInterviewDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { InterviewsService } from './interviews.service';
import { MeetService } from './meet.service';

const listQuerySchema = z.object({
  side: interviewSideSchema.default('ATTENDING'),
  filter: interviewFilterSchema.default('UPCOMING'),
});
type ListQuery = z.output<typeof listQuerySchema>;

@ApiTags('interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(
    private readonly interviews: InterviewsService,
    private readonly meet: MeetService,
  ) {}

  /**
   * One day of interviews, both sides, with the week around it.
   *
   * Declared above `:id` — Nest matches routes in order, and a dynamic
   * segment placed first would read "day" as an interview id.
   */
  @Get('day')
  @ApiOperation({ summary: 'Interviews on one day, hosting and attending' })
  async day(@CurrentUser('userId') userId: string, @Query('date') date?: string) {
    return this.meet.day(userId, date);
  }

  @Post('join')
  @ApiOperation({ summary: 'Find one of your interviews from a code or a link' })
  async join(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(joinInterviewSchema)) dto: JoinInterviewDto,
  ) {
    return this.meet.join(userId, dto.code);
  }

  @Get('me')
  @ApiOperation({ summary: 'Interviews you are hosting or attending, with the tab counts' })
  async list(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.interviews.list(userId, query.side, query.filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One interview' })
  async one(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviews.one(userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Invite an applicant to an interview, online or in person' })
  async schedule(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(scheduleInterviewSchema)) dto: ScheduleInterviewDto,
  ) {
    return this.interviews.schedule(userId, dto);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Accept or decline an invitation' })
  async respond(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(respondToInterviewSchema)) dto: RespondToInterviewDto,
  ) {
    return this.interviews.respond(userId, id, dto);
  }

  @Post(':id/reschedule')
  @ApiOperation({ summary: 'Move an interview; the candidate is asked again' })
  async reschedule(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rescheduleInterviewSchema)) dto: RescheduleInterviewDto,
  ) {
    return this.interviews.reschedule(userId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Call an interview off, with a reason' })
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cancelInterviewSchema)) dto: CancelInterviewDto,
  ) {
    return this.interviews.cancel(userId, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Close an interview and record what came of it' })
  async complete(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(completeInterviewSchema)) dto: CompleteInterviewDto,
  ) {
    return this.interviews.complete(userId, id, dto);
  }
}
