import { Module } from '@nestjs/common';
import { MockTestsController } from './mock-tests.controller';
import { MockTestsService } from './mock-tests.service';

/** Practice tests: generated questions, marking, and what to work on next. */
@Module({
  controllers: [MockTestsController],
  providers: [MockTestsService],
})
export class MockTestsModule {}
