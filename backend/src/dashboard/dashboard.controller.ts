import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview() {
    return this.dashboard.overview();
  }

  @Get('analytics')
  analytics() {
    return this.dashboard.analytics();
  }

  @Get('menu-badges')
  menuBadges() {
    return this.dashboard.menuBadges();
  }
}
