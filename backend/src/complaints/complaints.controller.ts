import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { ListComplaintsDto, ReplyComplaintDto, UpdateComplaintDto } from './dto/complaint.dto';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  list(@Query() query: ListComplaintsDto) {
    return this.complaints.list(query);
  }

  @Get('backlog')
  backlog() {
    return this.complaints.backlog();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.complaints.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.complaints.update(id, dto, admin.id);
  }

  @Post(':id/reply')
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyComplaintDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.complaints.reply(id, dto, admin.id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.complaints.assign(id, admin.id);
  }

  @Post(':id/escalate')
  escalate(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.complaints.escalate(id, admin.id);
  }

  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() dto: { resolution?: string },
    @CurrentUser() admin: { id: string },
  ) {
    return this.complaints.resolve(id, dto?.resolution, admin.id);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.complaints.reopen(id, admin.id);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.complaints.close(id, admin.id);
  }
}
