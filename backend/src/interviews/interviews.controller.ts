import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import {
  CancelInterviewDto,
  CreateInterviewDto,
  ListInterviewsDto,
  UpdateInterviewDto,
} from './dto/interview.dto';
import { InterviewsService } from './interviews.service';

type Admin = { id: string };

/// Item 10 — the admin-managed interview list.
@Controller('interviews')
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  list(@Query() query: ListInterviewsDto) {
    return this.interviews.list(query);
  }

  @Get('status-counts')
  statusCounts() {
    return this.interviews.statusCounts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.interviews.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInterviewDto, @CurrentUser() admin: Admin) {
    return this.interviews.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInterviewDto, @CurrentUser() admin: Admin) {
    return this.interviews.update(id, dto, admin.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelInterviewDto, @CurrentUser() admin: Admin) {
    return this.interviews.cancel(id, dto?.reason, admin.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.interviews.remove(id, admin.id);
  }
}
