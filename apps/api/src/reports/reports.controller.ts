import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReportSchema, type CreateReportDto } from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: "The signed-in account's own reports" })
  async mine(@CurrentUser('userId') userId: string) {
    return this.reports.mine(userId);
  }

  @Post()
  @ApiOperation({ summary: 'File a report' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createReportSchema)) dto: CreateReportDto,
  ) {
    return this.reports.create(userId, dto);
  }
}
