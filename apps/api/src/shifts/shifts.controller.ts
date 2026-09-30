import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  cancelShiftSchema,
  confirmReplacementSchema,
  createShiftSchema,
  notifyReplacementsSchema,
  shiftCheckInSchema,
  shiftCheckOutSchema,
  shiftFilterSchema,
  shiftSideSchema,
  type CancelShiftDto,
  type ConfirmReplacementDto,
  type CreateShiftDto,
  type NotifyReplacementsDto,
  type ShiftCheckInDto,
  type ShiftCheckOutDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ShiftsService } from './shifts.service';
import { CalendarService } from './calendar.service';
import { ReplacementService } from './replacement.service';

const listQuerySchema = z.object({
  side: shiftSideSchema.default('WORK'),
  filter: shiftFilterSchema.default('UPCOMING'),
});
type ListQuery = z.output<typeof listQuerySchema>;

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(
    private readonly shifts: ShiftsService,
    private readonly calendar: CalendarService,
    private readonly cover: ReplacementService,
  ) {}

  @Get('calendar')
  @ApiOperation({ summary: 'Shifts and interviews on one calendar, both sides' })
  async calendarEvents(
    @CurrentUser('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.events(userId, from, to);
  }

  @Get('me')
  @ApiOperation({ summary: 'Shifts you work or shifts you posted, with the tab counts' })
  async list(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.shifts.list(userId, query.side, query.filter);
  }

  /**
   * Declared above `:id` — Nest matches in order, and a dynamic segment
   * placed first would read "gaps" as a shift id.
   */
  @Get('gaps')
  @ApiOperation({ summary: 'Shifts somebody cancelled that still need covering' })
  async gaps(@CurrentUser('userId') userId: string) {
    return this.cover.gaps(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One shift, with everything needed to turn up to it' })
  async one(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shifts.one(userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Put someone you hired on a shift' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createShiftSchema)) dto: CreateShiftDto,
  ) {
    return this.shifts.create(userId, dto);
  }

  @Post(':id/check-in')
  @ApiOperation({ summary: 'Arrive: records the time on this server, not the phone' })
  async checkIn(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(shiftCheckInSchema)) dto: ShiftCheckInDto,
  ) {
    return this.shifts.checkIn(userId, id, dto);
  }

  @Post(':id/check-out')
  @ApiOperation({ summary: 'Leave: settles what the shift paid' })
  async checkOut(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(shiftCheckOutSchema)) dto: ShiftCheckOutDto,
  ) {
    return this.shifts.checkOut(userId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Call a shift off, with a reason' })
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(cancelShiftSchema)) dto: CancelShiftDto,
  ) {
    return this.shifts.cancel(userId, id, dto);
  }

  // --- covering a cancelled shift ---

  @Get(':id/cover')
  @ApiOperation({ summary: 'Who could cover this cancelled shift, ranked' })
  async coverList(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cover.candidates(userId, id);
  }

  @Post(':id/cover/ask')
  @ApiOperation({ summary: 'Send the shortlist your message about this shift' })
  async ask(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(notifyReplacementsSchema)) dto: NotifyReplacementsDto,
  ) {
    return this.cover.notify(userId, id, dto);
  }

  @Post(':id/cover/confirm')
  @ApiOperation({ summary: 'Put one of them on the shift' })
  async confirmCover(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(confirmReplacementSchema)) dto: ConfirmReplacementDto,
  ) {
    return this.cover.confirm(userId, id, dto);
  }
}
