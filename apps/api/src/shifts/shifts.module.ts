import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { CalendarService } from './calendar.service';
import { ReplacementService } from './replacement.service';

/**
 * Shifts and the attendance on them. See ShiftsService for who may do what.
 *
 * MatchingModule is here for the replacement matcher, which scores a CV
 * against the job the same way the feed does — one scoring rule, so an
 * employer never sees two different numbers for the same pairing.
 */
@Module({
  imports: [MatchingModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, CalendarService, ReplacementService],
})
export class ShiftsModule {}
