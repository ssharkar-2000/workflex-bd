import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { MeetService } from './meet.service';

/** Interviews, online or in person. See InterviewsService for who may do what. */
@Module({
  // For Google Meet: video interviews get a Meet room when the recruiter
  // has connected their Google account, and a Jitsi room when not.
  imports: [GoogleModule],
  controllers: [InterviewsController],
  providers: [InterviewsService, MeetService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
