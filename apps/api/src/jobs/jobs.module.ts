import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { StorageModule } from '../storage/storage.module';
import { JobsController } from './jobs.controller';
import { ApplyDraftService } from './apply-draft.service';
import { JobDraftService } from './job-draft.service';
import { VolunteerIdeasService } from './volunteer-ideas.service';
import { InternshipIdeasService } from './internship-ideas.service';
import { DemandMapService } from './demand-map.service';
import { ShortlistService } from './shortlist.service';
import { SkillTrendsService } from './skill-trends.service';
import { OpportunityService } from './opportunity.service';
import { JobsService } from './jobs.service';

@Module({
  // For MatchService: every listing the feed returns carries a match score
  // when the account has a parsed CV.
  imports: [MatchingModule, StorageModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobDraftService,
    ApplyDraftService,
    VolunteerIdeasService,
    InternshipIdeasService,
    DemandMapService,
    ShortlistService,
    SkillTrendsService,
    OpportunityService,
  ],
  exports: [JobsService],
})
export class JobsModule {}
