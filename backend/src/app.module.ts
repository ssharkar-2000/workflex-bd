import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { CmsModule } from './cms/cms.module';
import { CommonModule } from './common/common.module';
import { CompaniesModule } from './companies/companies.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmployersModule } from './employers/employers.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SecurityModule } from './security/security.module';
import { SystemModule } from './system/system.module';
import { VerificationsModule } from './verifications/verifications.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    AttendanceModule,
    PaymentsModule,
    VerificationsModule,

    // Trust, support, content
    AlertsModule,
    ComplaintsModule,
    NotificationsModule,
    ReportsModule,
    CmsModule,
    SystemModule,
  ],
})
export class AppModule {}
