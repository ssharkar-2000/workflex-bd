import { Module } from '@nestjs/common';
import { UserNotificationsReadService } from './user-notifications-read.service';
import { UserNotificationsController } from './user-notifications.controller';

@Module({
  controllers: [UserNotificationsController],
  providers: [UserNotificationsReadService],
})
export class UserNotificationsModule {}
