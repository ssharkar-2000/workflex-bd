import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { ListAttendanceDto, MarkAttendanceDto } from './dto/attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  list(@Query() query: ListAttendanceDto) {
    return this.attendance.list(query);
  }

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.attendance.summary(date);
  }

  @Post()
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() admin: { id: string }) {
    return this.attendance.mark(dto, admin.id);
  }
}
