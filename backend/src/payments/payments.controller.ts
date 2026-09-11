import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateRefundDto, ListTransactionsDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

type Admin = { id: string };

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('summary')
  summary() {
    return this.payments.summary();
  }

  @Get('revenue-series')
  revenueSeries() {
    return this.payments.revenueSeries();
  }

  @Get('transactions')
  list(@Query() query: ListTransactionsDto) {
    return this.payments.list(query);
  }

  @Get('transactions/:id')
  findOne(@Param('id') id: string) {
    return this.payments.findOne(id);
  }

  @Post('transactions/:id/refund')
  refund(@Param('id') id: string, @Body() dto: CreateRefundDto, @CurrentUser() admin: Admin) {
    return this.payments.refund(id, dto.amount, dto.reason, admin.id);
  }

  @Post('transactions/:id/retry')
  retry(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.payments.retry(id, admin.id);
  }
}
