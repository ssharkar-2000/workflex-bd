import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  // For MatchService: every listing the feed returns carries a match score
  // when the account has a parsed CV.
  imports: [MatchingModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
