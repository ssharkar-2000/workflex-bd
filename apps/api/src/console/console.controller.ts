import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { ConsoleDashboardService } from './console-dashboard.service';
import { ConsoleWorkersService } from './console-workers.service';

/**
 * The admin console's own endpoints.
 *
 * The console (apps/admin) was written against a different backend, with its
 * own paths and response shapes. Rather than rewrite forty screens, this
 * module answers those paths from this system's tables — so there is one
 * database and one API behind both the worker app and the console.
 *
 * It sits under `console/` because several of those paths — `jobs`,
 * `notifications`, `reports` — already mean something else in this API, where
 * they serve the worker app and return quite different shapes.
 *
 * Every route here is admin-only, and read-only for now: the screens that
 * write (approving an applicant, resolving a complaint) come next, and go
 * through the services that already own those rules rather than touching the
 * tables from here.
 */
@ApiTags('console')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('console')
export class ConsoleController {
  constructor(
    private readonly dashboard: ConsoleDashboardService,
    private readonly workers: ConsoleWorkersService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Console home: totals, account states, notices' })
  async overview() {
    return this.dashboard.overview();
  }

  @Get('dashboard/analytics')
  @ApiOperation({ summary: 'Takings by month, for the home chart' })
  async analytics() {
    return this.dashboard.analytics();
  }

  @Get('dashboard/menu-badges')
  @ApiOperation({ summary: 'Counts for the badges on the console menu' })
  async menuBadges() {
    return this.dashboard.menuBadges();
  }

  @Get('workers')
  @ApiOperation({ summary: 'Accounts, paged, with the console filters' })
  async workerList(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workers.list({
      status,
      search: search?.trim() || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('workers/status-counts')
  @ApiOperation({ summary: 'Counts behind the Workers screen tabs' })
  async workerCounts() {
    return this.workers.statusCounts();
  }

  @Get('workers/:id')
  @ApiOperation({ summary: 'One account, as the console profile screen shows it' })
  async worker(@Param('id') id: string) {
    return this.workers.one(id);
  }
}
