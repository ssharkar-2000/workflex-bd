import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { BansService } from './bans.service';
import { CancelBanDto, ListBansDto, ScheduleBanDto } from './dto/ban.dto';

type Admin = { id: string };

@Controller('bans')
@UseGuards(JwtAuthGuard)
export class BansController {
  constructor(private readonly bans: BansService) {}

  @Get()
  list(@Query() query: ListBansDto) {
    return this.bans.list(query);
  }

  /// Item 8 — the review queue of workers whose recent transactions look off.
  @Get('irregular-transactions')
  irregular() {
    return this.bans.irregularTransactions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bans.findOne(id);
  }

  /// Raises the notice and sends the user their 24-hour warning. Does not
  /// suspend anyone — see BansCronService.
  @Post()
  schedule(@Body() dto: ScheduleBanDto, @CurrentUser() admin: Admin) {
    return this.bans.schedule(dto, admin.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelBanDto, @CurrentUser() admin: Admin) {
    return this.bans.cancel(id, dto ?? {}, admin.id);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.bans.executeNow(id, admin.id);
  }
}
