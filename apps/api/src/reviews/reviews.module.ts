import { Module } from '@nestjs/common';
import { HiresController } from './hires.controller';
import { HiresService } from './hires.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Ratings in both directions, and the hired lists they are given from. See
 * ReviewsService for who may review whom.
 */
@Module({
  controllers: [ReviewsController, HiresController],
  providers: [ReviewsService, HiresService],
})
export class ReviewsModule {}
