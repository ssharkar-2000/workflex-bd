import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AlertsService } from './alerts.service';
import { EscalateAlertDto, ListAlertsDto, ResolveAlertDto } from './dto/alert.dto';

type Admin = { id: string };

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@Query() query: ListAlertsDto) {
    return this.alerts.list(query);
  }

  @Get('summary')
  summary() {
    return this.alerts.summary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alerts.findOne(id);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveAlertDto, @CurrentUser() admin: Admin) {
    return this.alerts.resolve(id, dto.actionTaken, admin.id);
  }

  @Post(':id/escalate')
  escalate(@Param('id') id: string, @Body() dto: EscalateAlertDto, @CurrentUser() admin: Admin) {
    return this.alerts.escalate(id, dto.actionTaken, admin.id);
  }
}
