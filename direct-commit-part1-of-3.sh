#!/usr/bin/env bash
# Direct commit script part 1 of 3 (no if/else, assumes files already extracted in place)
set -e

BRANCH="my-local-work"
echo "Creating/switching to branch $BRANCH ..."
git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH"

# [1/181] README.md
git add "README.md"
git commit -m 'docs: add project README with setup and overview instructions' --quiet

# [2/181] STATUS.md
git add "STATUS.md"
git commit -m 'docs: add project status / progress notes' --quiet

# [3/181] backend/.env
git add "backend/.env"
git commit -m 'chore(backend): add local environment variables (not for VCS)' --quiet

# [4/181] backend/.env.example
git add "backend/.env.example"
git commit -m 'chore(backend): add environment variable template' --quiet

# [5/181] backend/nest-cli.json
git add "backend/nest-cli.json"
git commit -m 'chore(backend): configure Nest CLI' --quiet

# [6/181] backend/package-lock.json
git add "backend/package-lock.json"
git commit -m 'chore(backend): add package-lock.json for dependency locking' --quiet

# [7/181] backend/package.json
git add "backend/package.json"
git commit -m 'chore(backend): add package.json with dependencies and scripts' --quiet

# [8/181] backend/prisma/migrations/20260902151837_init/migration.sql
git add "backend/prisma/migrations/20260902151837_init/migration.sql"
git commit -m 'feat(db): add migration - init' --quiet

# [9/181] backend/prisma/migrations/20260912090000_complaint_lifecycle/migration.sql
git add "backend/prisma/migrations/20260912090000_complaint_lifecycle/migration.sql"
git commit -m 'feat(db): add migration - complaint lifecycle' --quiet

# [10/181] backend/prisma/migrations/20260912100000_payment_method_and_refund_link/migration.sql
git add "backend/prisma/migrations/20260912100000_payment_method_and_refund_link/migration.sql"
git commit -m 'feat(db): add migration - payment method and refund link' --quiet

# [11/181] backend/prisma/migrations/20260916120000_user_messaging_bans_interviews_documents/migration.sql
git add "backend/prisma/migrations/20260916120000_user_messaging_bans_interviews_documents/migration.sql"
git commit -m 'feat(db): add migration - user messaging bans interviews documents' --quiet

# [12/181] backend/prisma/migrations/migration_lock.toml
git add "backend/prisma/migrations/migration_lock.toml"
git commit -m 'chore(db): add Prisma migration lock file' --quiet

# [13/181] backend/prisma/schema.prisma
git add "backend/prisma/schema.prisma"
git commit -m 'feat(db): define Prisma schema (models, relations, enums)' --quiet

# [14/181] backend/prisma/seed.ts
git add "backend/prisma/seed.ts"
git commit -m 'chore(db): add database seed script' --quiet

# [15/181] backend/src/admin/admin.controller.ts
git add "backend/src/admin/admin.controller.ts"
git commit -m 'feat(admin): add AdminController with endpoints: GET me, PATCH me' --quiet

# [16/181] backend/src/admin/admin.module.ts
git add "backend/src/admin/admin.module.ts"
git commit -m 'chore(admin): wire up AdminModule (imports, controllers, providers)' --quiet

# [17/181] backend/src/alerts/alerts.controller.ts
git add "backend/src/alerts/alerts.controller.ts"
git commit -m 'feat(alerts): add AlertsController with endpoints: GET /, GET summary, GET :id, POST :id/resolve, POST :id/escalate' --quiet

# [18/181] backend/src/alerts/alerts.module.ts
git add "backend/src/alerts/alerts.module.ts"
git commit -m 'chore(alerts): wire up AlertsModule (imports, controllers, providers)' --quiet

# [19/181] backend/src/alerts/alerts.service.ts
git add "backend/src/alerts/alerts.service.ts"
git commit -m 'feat(alerts): implement AlertsService business logic' --quiet

# [20/181] backend/src/alerts/dto/alert.dto.ts
git add "backend/src/alerts/dto/alert.dto.ts"
git commit -m 'feat(alerts): define DTOs - ListAlertsDto, ResolveAlertDto, EscalateAlertDto' --quiet

# [21/181] backend/src/app.module.ts
git add "backend/src/app.module.ts"
git commit -m 'chore(app.module.ts): wire up AppModule (imports, controllers, providers)' --quiet

# [22/181] backend/src/attendance/attendance.controller.ts
git add "backend/src/attendance/attendance.controller.ts"
git commit -m 'feat(attendance): add AttendanceController with endpoints: GET /, GET summary, POST /, POST :id/check-out' --quiet

# [23/181] backend/src/attendance/attendance.module.ts
git add "backend/src/attendance/attendance.module.ts"
git commit -m 'chore(attendance): wire up AttendanceModule (imports, controllers, providers)' --quiet

# [24/181] backend/src/attendance/attendance.service.ts
git add "backend/src/attendance/attendance.service.ts"
git commit -m 'feat(attendance): implement AttendanceService business logic' --quiet

# [25/181] backend/src/attendance/dto/attendance.dto.ts
git add "backend/src/attendance/dto/attendance.dto.ts"
git commit -m 'feat(attendance): define DTOs - ListAttendanceDto, MarkAttendanceDto' --quiet

# [26/181] backend/src/auth/auth.controller.ts
git add "backend/src/auth/auth.controller.ts"
git commit -m 'feat(auth): add AuthController with endpoints: POST sign-in, POST refresh, POST sign-out' --quiet

# [27/181] backend/src/auth/auth.module.ts
git add "backend/src/auth/auth.module.ts"
git commit -m 'chore(auth): wire up AuthModule (imports, controllers, providers)' --quiet

# [28/181] backend/src/auth/auth.service.ts
git add "backend/src/auth/auth.service.ts"
git commit -m 'feat(auth): implement AuthService business logic' --quiet

# [29/181] backend/src/auth/dto/auth.dto.ts
git add "backend/src/auth/dto/auth.dto.ts"
git commit -m 'feat(auth): define DTOs - SignInDto, RefreshDto' --quiet

# [30/181] backend/src/auth/jwt-auth.guard.ts
git add "backend/src/auth/jwt-auth.guard.ts"
git commit -m 'feat(auth): add JwtAuthGuard auth guard' --quiet

# [31/181] backend/src/auth/jwt.strategy.ts
git add "backend/src/auth/jwt.strategy.ts"
git commit -m 'feat(auth): add JwtStrategy passport strategy' --quiet

# [32/181] backend/src/bans/bans.controller.ts
git add "backend/src/bans/bans.controller.ts"
git commit -m 'feat(bans): add BansController with endpoints: GET /, GET irregular-transactions, GET :id, POST /, POST :id/cancel, POST :id/execute' --quiet

# [33/181] backend/src/bans/bans.cron.ts
git add "backend/src/bans/bans.cron.ts"
git commit -m 'feat(bans): add scheduled bans.cron job' --quiet

# [34/181] backend/src/bans/bans.module.ts
git add "backend/src/bans/bans.module.ts"
git commit -m 'chore(bans): wire up BansModule (imports, controllers, providers)' --quiet

# [35/181] backend/src/bans/bans.service.ts
git add "backend/src/bans/bans.service.ts"
git commit -m 'feat(bans): implement BansService business logic' --quiet

# [36/181] backend/src/bans/dto/ban.dto.ts
git add "backend/src/bans/dto/ban.dto.ts"
git commit -m 'feat(bans): define DTOs - ListBansDto, ScheduleBanDto, CancelBanDto' --quiet

# [37/181] backend/src/cms/cms.controller.ts
git add "backend/src/cms/cms.controller.ts"
git commit -m 'feat(cms): add CmsController with endpoints: GET /, GET :id, POST /, PATCH :id, DELETE :id' --quiet

# [38/181] backend/src/cms/cms.module.ts
git add "backend/src/cms/cms.module.ts"
git commit -m 'chore(cms): wire up CmsModule (imports, controllers, providers)' --quiet

# [39/181] backend/src/cms/cms.service.ts
git add "backend/src/cms/cms.service.ts"
git commit -m 'feat(cms): implement CmsService business logic' --quiet

# [40/181] backend/src/cms/dto/cms.dto.ts
git add "backend/src/cms/dto/cms.dto.ts"
git commit -m 'feat(cms): define DTOs - ListCmsDto, CreateCmsBlockDto, UpdateCmsBlockDto' --quiet

# [41/181] backend/src/common/audit.service.ts
git add "backend/src/common/audit.service.ts"
git commit -m 'feat(common): implement AuditService business logic' --quiet

# [42/181] backend/src/common/common.module.ts
git add "backend/src/common/common.module.ts"
git commit -m 'chore(common): wire up CommonModule (imports, controllers, providers)' --quiet

# [43/181] backend/src/common/current-user.decorator.ts
git add "backend/src/common/current-user.decorator.ts"
git commit -m 'feat(common): add custom current-user decorator' --quiet

# [44/181] backend/src/common/friendly-exception.filter.ts
git add "backend/src/common/friendly-exception.filter.ts"
git commit -m 'feat(common): add FriendlyExceptionFilter exception filter' --quiet

# [45/181] backend/src/common/mail.service.ts
git add "backend/src/common/mail.service.ts"
git commit -m 'feat(common): implement MailService business logic' --quiet

# [46/181] backend/src/common/pagination.dto.ts
git add "backend/src/common/pagination.dto.ts"
git commit -m 'feat(common): define DTOs - PaginationDto' --quiet

# [47/181] backend/src/common/serialize.interceptor.ts
git add "backend/src/common/serialize.interceptor.ts"
git commit -m 'feat(common): add SerializeInterceptor response interceptor' --quiet

# [48/181] backend/src/common/user-notifications.service.ts
git add "backend/src/common/user-notifications.service.ts"
git commit -m 'feat(common): implement UserNotificationsService business logic' --quiet

# [49/181] backend/src/companies/companies.controller.ts
git add "backend/src/companies/companies.controller.ts"
git commit -m 'feat(companies): add CompaniesController with endpoints: GET /, GET :id, POST /, PATCH :id' --quiet

# [50/181] backend/src/companies/companies.module.ts
git add "backend/src/companies/companies.module.ts"
git commit -m 'chore(companies): wire up CompaniesModule (imports, controllers, providers)' --quiet

# [51/181] backend/src/companies/companies.service.ts
git add "backend/src/companies/companies.service.ts"
git commit -m 'feat(companies): implement CompaniesService business logic' --quiet

# [52/181] backend/src/companies/dto/company.dto.ts
git add "backend/src/companies/dto/company.dto.ts"
git commit -m 'feat(companies): define DTOs - ListCompaniesDto, CreateCompanyDto, UpdateCompanyDto' --quiet

# [53/181] backend/src/complaints/complaints.controller.ts
git add "backend/src/complaints/complaints.controller.ts"
git commit -m 'feat(complaints): add ComplaintsController with endpoints: GET /, GET backlog, GET :id, PATCH :id, POST :id/reply, POST :id/assign (+4 more)' --quiet

# [54/181] backend/src/complaints/complaints.module.ts
git add "backend/src/complaints/complaints.module.ts"
git commit -m 'chore(complaints): wire up ComplaintsModule (imports, controllers, providers)' --quiet

# [55/181] backend/src/complaints/complaints.service.ts
git add "backend/src/complaints/complaints.service.ts"
git commit -m 'feat(complaints): implement ComplaintsService business logic' --quiet

# [56/181] backend/src/complaints/dto/complaint.dto.ts
git add "backend/src/complaints/dto/complaint.dto.ts"
git commit -m 'feat(complaints): define DTOs - ListComplaintsDto, UpdateComplaintDto, ReplyComplaintDto' --quiet

# [57/181] backend/src/dashboard/dashboard.controller.ts
git add "backend/src/dashboard/dashboard.controller.ts"
git commit -m 'feat(dashboard): add DashboardController with endpoints: GET /, GET analytics, GET menu-badges' --quiet

# [58/181] backend/src/dashboard/dashboard.module.ts
git add "backend/src/dashboard/dashboard.module.ts"
git commit -m 'chore(dashboard): wire up DashboardModule (imports, controllers, providers)' --quiet

# [59/181] backend/src/dashboard/dashboard.service.ts
git add "backend/src/dashboard/dashboard.service.ts"
git commit -m 'feat(dashboard): implement DashboardService business logic' --quiet

# [60/181] backend/src/documents/documents.controller.ts
git add "backend/src/documents/documents.controller.ts"
git commit -m 'feat(documents): add DocumentsController with endpoints: GET /, GET by-user, GET :id, POST /, DELETE :id' --quiet

# [61/181] backend/src/documents/documents.module.ts
git add "backend/src/documents/documents.module.ts"
git commit -m 'chore(documents): wire up DocumentsModule (imports, controllers, providers)' --quiet

