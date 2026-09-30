import { Module } from '@nestjs/common';
import { ChatRealtime } from './chat-realtime.service';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

/**
 * Job-linked conversations and direct messages, over HTTP with a live
 * Socket.IO channel beside it. See MessagingService for who may message whom.
 */
@Module({
  controllers: [MessagingController],
  providers: [MessagingService, ChatRealtime, MessagingGateway],
  // Meetings send their invitations through the same threads, and tell the
  // people concerned over the same socket.
  exports: [MessagingService, ChatRealtime],
})
export class MessagingModule {}
