import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { HireReplacementService } from './hire-replacement.service';
import { HiresController } from './hires.controller';
import { HiresService } from './hires.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Ratings in both directions, and the hired lists they are given from. See
 * ReviewsService for who may review whom, and HireReplacementService for what
 * happens when a hired worker can no longer do the job.
 */
@Module({
  // Replacements tell the people concerned through the job's conversation.
  imports: [MessagingModule],
  controllers: [ReviewsController, HiresController],
  providers: [ReviewsService, HiresService, HireReplacementService],
})
export class ReviewsModule {}
