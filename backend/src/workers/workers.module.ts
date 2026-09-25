import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [PaymentsModule],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
