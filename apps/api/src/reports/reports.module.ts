import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  // Exported for the admin console, which reads and resolves the same queue.
  exports: [ReportsService],
})
export class ReportsModule {}
