import { Module } from '@nestjs/common';
import { SmsModule } from '../sms/sms.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { KycReviewService } from './kyc-review.service';
import { AdminDirectoryService } from './admin-directory.service';
import { AdminInsightsService } from './admin-insights.service';
import { AdminContentService } from './admin-content.service';

@Module({
  imports: [SmsModule, UsersModule],
  controllers: [AdminController, AdminAuthController],
  providers: [
    KycReviewService,
    AdminAuthService,
    AdminDirectoryService,
    AdminInsightsService,
    AdminContentService,
  ],
})
export class AdminModule {}
