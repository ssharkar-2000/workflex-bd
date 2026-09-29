import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

/** Job-linked conversations. See MessagingService for who may message whom. */
@Module({
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
