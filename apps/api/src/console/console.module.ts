import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ConsoleController } from './console.controller';
import { ConsoleAuthController } from './console-auth.controller';
import { ConsoleDashboardService } from './console-dashboard.service';
import { ConsoleWorkersService } from './console-workers.service';

/**
 * Endpoints shaped for the admin console (apps/admin). See ConsoleController
 * for why they live under their own prefix.
 *
 * AdminModule for the sign-in service: the console uses the same Admin table
 * and the same token as this API's own admin login.
 */
@Module({
  imports: [AdminModule],
  controllers: [ConsoleController, ConsoleAuthController],
  providers: [ConsoleDashboardService, ConsoleWorkersService],
})
export class ConsoleModule {}
