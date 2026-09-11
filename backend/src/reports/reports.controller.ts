import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.summary(from, to);
  }

  @Get('transactions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="transactions.csv"')
  transactionsCsv(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.transactionsCsv(from, to);
  }
}
