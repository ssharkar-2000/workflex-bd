import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { ConsoleDashboardService } from './console-dashboard.service';
import { ConsoleWorkersService } from './console-workers.service';
import { ConsoleJobsService } from './console-jobs.service';
import { ConsoleOperationsService } from './console-operations.service';
import { ConsoleSupportService } from './console-support.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
    private readonly jobs: ConsoleJobsService,
    private readonly ops: ConsoleOperationsService,
    private readonly support: ConsoleSupportService,
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

  @Get('workers/:id/job-history')
  @ApiOperation({ summary: 'Jobs this account has been hired for' })
  async workerJobHistory(@Param('id') id: string) {
    return this.workers.jobHistory(id);
  }

  @Get('workers/:id/transactions')
  @ApiOperation({ summary: 'Money in and out of one wallet' })
  async workerTransactions(@Param('id') id: string) {
    return this.ops.transactions({ workerId: id });
  }

  @Post('workers/:id/:action')
  @ApiOperation({ summary: 'Suspend, restore or verify an account' })
  async decideWorker(@Param('id') id: string, @Param('action') action: string) {
    return this.workers.decide(id, action);
  }

  // --- jobs ---

  @Get('jobs')
  @ApiOperation({ summary: 'Postings, paged, with the console filters' })
  async jobList(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobs.list({
      status,
      search: search?.trim() || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('jobs/categories')
  @ApiOperation({ summary: 'Categories in use, with how many jobs each has' })
  async jobCategories() {
    return this.jobs.categories();
  }

  @Get('jobs/companies')
  @ApiOperation({ summary: 'Companies, for the jobs screen filter' })
  async jobCompanies() {
    return this.jobs.companies();
  }

  @Get('jobs/analytics')
  @ApiOperation({ summary: 'Volume, status mix and the busiest categories' })
  async jobAnalytics() {
    return this.jobs.analytics();
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'One posting' })
  async job(@Param('id') id: string) {
    return this.jobs.one(id);
  }

  @Get('jobs/:id/applications')
  @ApiOperation({ summary: 'Who applied to one posting' })
  async jobApplications(@Param('id') id: string) {
    return this.jobs.applications(id);
  }

  @Post('jobs/:id/applications/:workerId/:action')
  @ApiOperation({ summary: 'Shortlist, hire or turn down an applicant' })
  async decideApplication(
    @Param('id') id: string,
    @Param('workerId') workerId: string,
    @Param('action') action: string,
  ) {
    return this.jobs.decideApplication(id, workerId, action);
  }

  @Post('jobs/:id/:action')
  @ApiOperation({ summary: 'Close a posting, or open it again' })
  async decideJob(@Param('id') id: string, @Param('action') action: string) {
    return this.jobs.decide(id, action);
  }

  // --- identity ---

  @Get('verifications/pending-by-type')
  @ApiOperation({ summary: 'The identity queue, grouped as the console tabs it' })
  async verifications() {
    return this.ops.verificationsPendingByType();
  }

  @Post('verifications/:id/:action')
  @ApiOperation({ summary: 'Approve or reject one identity check' })
  async decideVerification(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: { note?: string; reason?: string },
  ) {
    return this.ops.decideVerification(adminId, id, action, body?.note ?? body?.reason);
  }

  @Get('documents/:userId')
  @ApiOperation({ summary: 'The documents on one account' })
  async documents(@Param('userId') userId: string) {
    return this.ops.documents(userId);
  }

  // --- the people who hire ---

  @Get('employers')
  @ApiOperation({ summary: 'Accounts that hire, paged' })
  async employers(
    @Query('verified') verified?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.employers({
      verified,
      search: search?.trim() || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('employers/counts')
  @ApiOperation({ summary: 'Counts behind the employers screen tabs' })
  async employerCounts() {
    return this.ops.employerCounts();
  }

  @Get('employers/:id')
  @ApiOperation({ summary: 'One employer' })
  async employer(@Param('id') id: string) {
    return this.ops.employer(id);
  }

  @Get('companies')
  @ApiOperation({ summary: 'Registered companies and who owns each' })
  async companies(@Query('search') search?: string) {
    return this.ops.companies(search?.trim() || undefined);
  }

  // --- money ---

  @Get('payments/summary')
  @ApiOperation({ summary: 'Takings, balances and what is waiting to go out' })
  async paymentsSummary() {
    return this.ops.paymentsSummary();
  }

  @Get('payments/revenue-series')
  @ApiOperation({ summary: 'Six months of takings' })
  async revenueSeries() {
    return this.ops.revenueSeries();
  }

  @Get('payments/transactions')
  @ApiOperation({ summary: 'Payments and withdrawals, as one ledger' })
  async transactions(@Query('limit') limit?: string) {
    return this.ops.transactions({ limit: limit ? Number(limit) : undefined });
  }

  // --- work ---

  @Get('attendance/summary')
  @ApiOperation({ summary: 'Today across the platform, and who is checked in' })
  async attendance() {
    return this.ops.attendanceSummary();
  }

  @Post('attendance/:id/check-out')
  @ApiOperation({ summary: 'End a check-in somebody forgot to close' })
  async attendanceCheckOut(@Param('id') id: string) {
    return this.ops.checkOut(id);
  }

  // --- support ---

  @Get('complaints/backlog')
  @ApiOperation({ summary: 'How many tickets have sat unanswered too long' })
  async backlog() {
    return this.support.backlog();
  }

  @Get('complaints')
  @ApiOperation({ summary: 'Support tickets, paged' })
  async complaints(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.support.complaints({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('complaints/:id')
  @ApiOperation({ summary: 'One ticket' })
  async complaint(@Param('id') id: string) {
    return this.support.complaint(id);
  }

  @Post('complaints/:id/reply')
  @ApiOperation({ summary: 'Answer a ticket' })
  async replyToComplaint(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() body: { message?: string },
  ) {
    return this.support.reply(adminId, id, body?.message ?? '');
  }

  @Post('complaints/:id/:action')
  @ApiOperation({ summary: 'Move a ticket along' })
  async decideComplaint(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Param('action') action: string,
  ) {
    return this.support.decideComplaint(adminId, id, action);
  }

  // --- notices and reporting ---

  @Get('notifications')
  @ApiOperation({ summary: 'What the platform has announced' })
  async notifications() {
    return this.support.notifications();
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark every notice read' })
  async readAll() {
    return this.support.markRead();
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one notice read' })
  async readOne() {
    return this.support.markRead();
  }

  @Get('reports/summary')
  @ApiOperation({ summary: 'The platform summary the reports screen opens with' })
  async reportSummary() {
    return this.support.reportSummary();
  }

  @Get('subscriptions/summary')
  @ApiOperation({ summary: 'Plans in force, by tier' })
  async subscriptions() {
    return this.ops.subscriptionsSummary();
  }

  // --- interviews ---

  @Get('interviews')
  @ApiOperation({ summary: 'Meetings arranged between employers and candidates' })
  async interviews(@Query('filter') filter?: string) {
    return this.ops.interviews(filter);
  }

  @Get('interviews/status-counts')
  @ApiOperation({ summary: 'Counts behind the interviews screen tabs' })
  async interviewCounts() {
    return this.ops.interviewCounts();
  }

  @Post('interviews/:id/cancel')
  @ApiOperation({ summary: 'Call a meeting off from the console' })
  async cancelInterview(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.ops.cancelInterview(adminId, id, body?.reason);
  }

  // --- security and system ---

  @Get('security/overview')
  @ApiOperation({ summary: 'Sessions, suspensions and admin accounts' })
  async security() {
    return this.ops.securityOverview();
  }

  @Get('security/sessions')
  @ApiOperation({ summary: 'Sessions open right now' })
  async sessions() {
    return this.ops.securitySessions();
  }

  @Post('security/sessions/:userId/revoke')
  @ApiOperation({ summary: 'Sign one person out of every device' })
  async revoke(@Param('userId') userId: string) {
    return this.ops.revokeSessions(userId);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Runtime and table counts' })
  async health() {
    return this.ops.systemHealth();
  }

  /**
   * Screens this platform has no data for.
   *
   * Alerts, interviews, bans, maintenance windows and the CMS were tables in
   * the console's old backend and have no equivalent here. They answer with
   * an empty set so the screen shows its own "nothing here" state, which is
   * true, instead of an error, which would suggest something is broken.
   */
  @Get([
    'alerts',
    'alerts/summary',
    'bans',
    'bans/irregular-transactions',
    'cms',
    'system/maintenance',
    'system/settings',
  ])
  @ApiOperation({ summary: 'Not recorded by this platform: answers empty' })
  async notRecorded() {
    return {
      items: [],
      meta: { total: 0, page: 1, limit: 0, pages: 1 },
      counts: {},
      windowHours: 24,
      thresholds: { largeAmount: 0, burstCount: 0, failureCount: 0 },
      all: 0,
      upcoming: 0,
      today: 0,
      completed: 0,
      cancelled: 0,
    };
  }
}
