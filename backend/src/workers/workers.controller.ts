import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WorkerStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ListTransactionsDto } from '../payments/dto/payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { ListWorkersDto, SuspendWorkerDto, UpdateWorkerDto } from './dto/worker.dto';
import { WorkersService } from './workers.service';

type Admin = { id: string };

@Controller('workers')
@UseGuards(JwtAuthGuard)
export class WorkersController {
  constructor(
    private readonly workers: WorkersService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  list(@Query() query: ListWorkersDto) {
    return this.workers.list(query);
  }

  @Get('status-counts')
  statusCounts() {
    return this.workers.statusCounts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workers.findOne(id);
  }

  @Get(':id/job-history')
  jobHistory(@Param('id') id: string) {
    return this.workers.jobHistory(id);
  }

  /// Every transaction this worker has ever been part of — who paid them,
  /// which job it was for, and cash-in/cash-out totals for the last 30 days.
  /// Sorting defaults to newest-first like the global Payments screen; pass
  /// ?sort=asc for "1st to last" chronological order.
  @Get(':id/transactions')
  transactions(@Param('id') id: string, @Query() query: ListTransactionsDto) {
    return this.payments.list({ ...query, workerId: id });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto, @CurrentUser() admin: Admin) {
    return this.workers.update(id, dto, admin.id);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.workers.setStatus(id, WorkerStatus.ACTIVE, admin.id);
  }

  @Post(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendWorkerDto,
    @CurrentUser() admin: Admin,
  ) {
    return this.workers.setStatus(id, WorkerStatus.SUSPENDED, admin.id, dto.reason);
  }

  @Post(':id/reinstate')
  reinstate(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.workers.setStatus(id, WorkerStatus.ACTIVE, admin.id);
  }
}
