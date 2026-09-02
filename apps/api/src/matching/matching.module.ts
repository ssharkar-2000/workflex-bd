import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { VerificationModule } from '../verification/verification.module';
import { MatchingController } from './matching.controller';
import { CvService } from './cv.service';
import { CvParserService } from './cv-parser.service';
import { MatchService } from './match.service';
import { RecommendService } from './recommend.service';
import { SkillGapService } from './skill-gap.service';

/**
 * CV understanding and job matching.
 *
 * `MatchService` is exported because the jobs feed attaches a score to every
 * listing it returns; the rest stays internal.
 */
@Module({
  imports: [StorageModule, VerificationModule],
  controllers: [MatchingController],
  providers: [
    CvService,
    CvParserService,
    MatchService,
    RecommendService,
    SkillGapService,
  ],
  exports: [MatchService, RecommendService, SkillGapService, CvService],
})
export class MatchingModule {}
