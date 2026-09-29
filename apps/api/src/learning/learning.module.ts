import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { StorageModule } from '../storage/storage.module';
import { CoursesService } from './courses.service';
import { LearningController } from './learning.controller';

/**
 * The learning lab.
 *
 * It owns nothing about skills itself: the gaps come from MatchingModule,
 * which already derives them from the CV and from open postings. What lives
 * here is the half that follows — where to go and learn one, and the record
 * of having done it.
 */
@Module({
  imports: [MatchingModule, StorageModule],
  controllers: [LearningController],
  providers: [CoursesService],
})
export class LearningModule {}
