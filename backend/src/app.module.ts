import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { BansModule } from './bans/bans.module';
import { CmsModule } from './cms/cms.module';
import { CommonModule } from './common/common.module';
import { CompaniesModule } from './companies/companies.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { EmployersModule } from './employers/employers.module';
import { InterviewsModule } from './interviews/interviews.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SecurityModule } from './security/security.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SupportModule } from './support/support.module';
import { SystemModule } from './system/system.module';
import { UserNotificationsModule } from './user-notifications/user-notifications.module';
import { VerificationsModule } from './verifications/verifications.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,

    // Access
    AuthModule,
    AdminModule,
    SecurityModule,

    // Marketplace
    DashboardModule,
    WorkersModule,
    EmployersModule,
    CompaniesModule,
    JobsModule,
    // Item 10 — the admin-managed interview list.
    InterviewsModule,
    AttendanceModule,
    PaymentsModule,
    VerificationsModule,
    SubscriptionsModule,
    // Item 11 — documents filed under user id + job id.
    DocumentsModule,

    // Trust, support, content
    AlertsModule,
    ComplaintsModule,
    NotificationsModule,
    // Item 9 — user help messages and their instant auto-reply.
    SupportModule,
    // Items 7/8/9/10/12 — the outbound message log for end users.
    UserNotificationsModule,
    // Item 8 — irregular-transaction review and the 24-hour ban notice.
    BansModule,
    ReportsModule,
    CmsModule,
    SystemModule,
  ],
})
export class AppModule {}
