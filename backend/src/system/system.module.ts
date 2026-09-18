import { Module } from '@nestjs/common';
import { MaintenanceCronService } from './maintenance.cron';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  controllers: [SystemController],
  providers: [SystemService, MaintenanceCronService],
})
export class SystemModule {}
