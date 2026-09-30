import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { LivekitService } from './livekit.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsWebhookController } from './meetings-webhook.controller';

/** Scheduled meetings, invitations, and passes into LiveKit video rooms. */
@Module({
  imports: [MessagingModule],
  controllers: [MeetingsController, MeetingsWebhookController],
  providers: [MeetingsService, LivekitService],
})
export class MeetingsModule {}
