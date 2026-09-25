import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { MailService } from './mail.service';
import { UserNotificationsService } from './user-notifications.service';

@Global()
@Module({
  providers: [AuditService, MailService, UserNotificationsService],
  exports: [AuditService, MailService, UserNotificationsService],
})
export class CommonModule {}
