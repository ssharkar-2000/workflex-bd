# ============================================================
# workflex-bd -- Batch 2, 3, 4, 5 (batch 1 already done)
# Run this ONCE from inside your project folder in PowerShell:
#   .\push-batches-2-to-5.ps1
# If PowerShell blocks the script, first run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ============================================================

$ErrorActionPreference = "Continue"

# ============================================================
# BATCH 2 -- backend module 1-9
# ============================================================
git checkout -b feature/backend-common
git add backend/src/common/pagination.dto.ts
git commit -m "feat(backend-common): add pagination.dto.ts"
git add backend/src/common/serialize.interceptor.ts
git commit -m "feat(backend-common): add serialize.interceptor.ts"
git add backend/src/common/current-user.decorator.ts
git commit -m "feat(backend-common): add current-user.decorator.ts"
git add backend/src/common/audit.service.ts
git commit -m "feat(backend-common): add audit.service.ts"
git add backend/src/common/common.module.ts
git commit -m "feat(backend-common): add common.module.ts"
git checkout main
git merge --no-ff feature/backend-common -m "merge: integrate common module"
git branch -d feature/backend-common

git checkout -b feature/backend-auth
git add backend/src/auth/dto/auth.dto.ts
git commit -m "feat(backend-auth): add auth.dto.ts"
git add backend/src/auth/auth.module.ts
git commit -m "feat(backend-auth): add auth.module.ts"
git add backend/src/auth/jwt.strategy.ts
git commit -m "feat(backend-auth): add jwt.strategy.ts"
git add backend/src/auth/jwt-auth.guard.ts
git commit -m "feat(backend-auth): add jwt-auth.guard.ts"
git add backend/src/auth/auth.service.ts
git commit -m "feat(backend-auth): add auth.service.ts"
git add backend/src/auth/auth.controller.ts
git commit -m "feat(backend-auth): add auth.controller.ts"
git checkout main
git merge --no-ff feature/backend-auth -m "merge: integrate auth module"
git branch -d feature/backend-auth

git checkout -b feature/backend-admin
git add backend/src/admin/admin.controller.ts
git commit -m "feat(backend-admin): add admin.controller.ts"
git add backend/src/admin/admin.module.ts
git commit -m "feat(backend-admin): add admin.module.ts"
git checkout main
git merge --no-ff feature/backend-admin -m "merge: integrate admin module"
git branch -d feature/backend-admin

git checkout -b feature/backend-alerts
git add backend/src/alerts/dto/alert.dto.ts
git commit -m "feat(backend-alerts): add alert.dto.ts"
git add backend/src/alerts/alerts.controller.ts
git commit -m "feat(backend-alerts): add alerts.controller.ts"
git add backend/src/alerts/alerts.service.ts
git commit -m "feat(backend-alerts): add alerts.service.ts"
git add backend/src/alerts/alerts.module.ts
git commit -m "feat(backend-alerts): add alerts.module.ts"
git checkout main
git merge --no-ff feature/backend-alerts -m "merge: integrate alerts module"
git branch -d feature/backend-alerts

git checkout -b feature/backend-attendance
git add backend/src/attendance/dto/attendance.dto.ts
git commit -m "feat(backend-attendance): add attendance.dto.ts"
git add backend/src/attendance/attendance.controller.ts
git commit -m "feat(backend-attendance): add attendance.controller.ts"
git add backend/src/attendance/attendance.service.ts
git commit -m "feat(backend-attendance): add attendance.service.ts"
git add backend/src/attendance/attendance.module.ts
git commit -m "feat(backend-attendance): add attendance.module.ts"
git checkout main
git merge --no-ff feature/backend-attendance -m "merge: integrate attendance module"
git branch -d feature/backend-attendance

git checkout -b feature/backend-cms
git add backend/src/cms/dto/cms.dto.ts
git commit -m "feat(backend-cms): add cms.dto.ts"
git add backend/src/cms/cms.controller.ts
git commit -m "feat(backend-cms): add cms.controller.ts"
git add backend/src/cms/cms.service.ts
git commit -m "feat(backend-cms): add cms.service.ts"
git add backend/src/cms/cms.module.ts
git commit -m "feat(backend-cms): add cms.module.ts"
git checkout main
git merge --no-ff feature/backend-cms -m "merge: integrate cms module"
git branch -d feature/backend-cms

git checkout -b feature/backend-companies
git add backend/src/companies/companies.controller.ts
git commit -m "feat(backend-companies): add companies.controller.ts"
git add backend/src/companies/dto/company.dto.ts
git commit -m "feat(backend-companies): add company.dto.ts"
git add backend/src/companies/companies.service.ts
git commit -m "feat(backend-companies): add companies.service.ts"
git add backend/src/companies/companies.module.ts
git commit -m "feat(backend-companies): add companies.module.ts"
git checkout main
git merge --no-ff feature/backend-companies -m "merge: integrate companies module"
git branch -d feature/backend-companies

git checkout -b feature/backend-complaints
git add backend/src/complaints/dto/complaint.dto.ts
git commit -m "feat(backend-complaints): add complaint.dto.ts"
git add backend/src/complaints/complaints.module.ts
git commit -m "feat(backend-complaints): add complaints.module.ts"
git add backend/src/complaints/complaints.service.ts
git commit -m "feat(backend-complaints): add complaints.service.ts"
git add backend/src/complaints/complaints.controller.ts
git commit -m "feat(backend-complaints): add complaints.controller.ts"
git checkout main
git merge --no-ff feature/backend-complaints -m "merge: integrate complaints module"
git branch -d feature/backend-complaints

git checkout -b feature/backend-dashboard
git add backend/src/dashboard/dashboard.module.ts
git commit -m "feat(backend-dashboard): add dashboard.module.ts"
git add backend/src/dashboard/dashboard.service.ts
git commit -m "feat(backend-dashboard): add dashboard.service.ts"
git add backend/src/dashboard/dashboard.controller.ts
git commit -m "feat(backend-dashboard): add dashboard.controller.ts"
git checkout main
git merge --no-ff feature/backend-dashboard -m "merge: integrate dashboard module"
git branch -d feature/backend-dashboard

Write-Host "=== BATCH 2 DONE, pushing... ==="
git push origin main

# ============================================================
# BATCH 3 -- backend module 10-18
# ============================================================
git checkout -b feature/backend-employers
git add backend/src/employers/dto/employer.dto.ts
git commit -m "feat(backend-employers): add employer.dto.ts"
git add backend/src/employers/employers.service.ts
git commit -m "feat(backend-employers): add employers.service.ts"
git add backend/src/employers/employers.controller.ts
git commit -m "feat(backend-employers): add employers.controller.ts"
git add backend/src/employers/employers.module.ts
git commit -m "feat(backend-employers): add employers.module.ts"
git checkout main
git merge --no-ff feature/backend-employers -m "merge: integrate employers module"
git branch -d feature/backend-employers

git checkout -b feature/backend-jobs
git add backend/src/jobs/dto/job.dto.ts
git commit -m "feat(backend-jobs): add job.dto.ts"
git add backend/src/jobs/jobs.controller.ts
git commit -m "feat(backend-jobs): add jobs.controller.ts"
git add backend/src/jobs/jobs.service.ts
git commit -m "feat(backend-jobs): add jobs.service.ts"
git add backend/src/jobs/jobs.module.ts
git commit -m "feat(backend-jobs): add jobs.module.ts"
git checkout main
git merge --no-ff feature/backend-jobs -m "merge: integrate jobs module"
git branch -d feature/backend-jobs

git checkout -b feature/backend-notifications
git add backend/src/notifications/notifications.module.ts
git commit -m "feat(backend-notifications): add notifications.module.ts"
git add backend/src/notifications/notifications.service.ts
git commit -m "feat(backend-notifications): add notifications.service.ts"
git add backend/src/notifications/notifications.controller.ts
git commit -m "feat(backend-notifications): add notifications.controller.ts"
git checkout main
git merge --no-ff feature/backend-notifications -m "merge: integrate notifications module"
git branch -d feature/backend-notifications

git checkout -b feature/backend-payments
git add backend/src/payments/payments.controller.ts
git commit -m "feat(backend-payments): add payments.controller.ts"
git add backend/src/payments/dto/payment.dto.ts
git commit -m "feat(backend-payments): add payment.dto.ts"
git add backend/src/payments/payments.module.ts
git commit -m "feat(backend-payments): add payments.module.ts"
git add backend/src/payments/payments.service.ts
git commit -m "feat(backend-payments): add payments.service.ts"
git checkout main
git merge --no-ff feature/backend-payments -m "merge: integrate payments module"
git branch -d feature/backend-payments

git checkout -b feature/backend-reports
git add backend/src/reports/reports.controller.ts
git commit -m "feat(backend-reports): add reports.controller.ts"
git add backend/src/reports/reports.module.ts
git commit -m "feat(backend-reports): add reports.module.ts"
git add backend/src/reports/reports.service.ts
git commit -m "feat(backend-reports): add reports.service.ts"
git checkout main
git merge --no-ff feature/backend-reports -m "merge: integrate reports module"
git branch -d feature/backend-reports

git checkout -b feature/backend-security
git add backend/src/security/security.controller.ts
git commit -m "feat(backend-security): add security.controller.ts"
git add backend/src/security/security.module.ts
git commit -m "feat(backend-security): add security.module.ts"
git add backend/src/security/security.service.ts
git commit -m "feat(backend-security): add security.service.ts"
git checkout main
git merge --no-ff feature/backend-security -m "merge: integrate security module"
git branch -d feature/backend-security

git checkout -b feature/backend-system
git add backend/src/system/dto/system.dto.ts
git commit -m "feat(backend-system): add system.dto.ts"
git add backend/src/system/system.service.ts
git commit -m "feat(backend-system): add system.service.ts"
git add backend/src/system/system.module.ts
git commit -m "feat(backend-system): add system.module.ts"
git add backend/src/system/system.controller.ts
git commit -m "feat(backend-system): add system.controller.ts"
git checkout main
git merge --no-ff feature/backend-system -m "merge: integrate system module"
git branch -d feature/backend-system

git checkout -b feature/backend-verifications
git add backend/src/verifications/verifications.module.ts
git commit -m "feat(backend-verifications): add verifications.module.ts"
git add backend/src/verifications/dto/verification.dto.ts
git commit -m "feat(backend-verifications): add verification.dto.ts"
git add backend/src/verifications/verifications.controller.ts
git commit -m "feat(backend-verifications): add verifications.controller.ts"
git add backend/src/verifications/verifications.service.ts
git commit -m "feat(backend-verifications): add verifications.service.ts"
git checkout main
git merge --no-ff feature/backend-verifications -m "merge: integrate verifications module"
git branch -d feature/backend-verifications

git checkout -b feature/backend-workers
git add backend/src/workers/dto/worker.dto.ts
git commit -m "feat(backend-workers): add worker.dto.ts"
git add backend/src/workers/workers.service.ts
git commit -m "feat(backend-workers): add workers.service.ts"
git add backend/src/workers/workers.module.ts
git commit -m "feat(backend-workers): add workers.module.ts"
git add backend/src/workers/workers.controller.ts
git commit -m "feat(backend-workers): add workers.controller.ts"
git checkout main
git merge --no-ff feature/backend-workers -m "merge: integrate workers module"
git branch -d feature/backend-workers

Write-Host "=== BATCH 3 DONE, pushing... ==="
git push origin main

# ============================================================
# BATCH 4 -- mobile core
# ============================================================
git checkout -b feature/mobile-core
git add mobile/package.json
git commit -m "chore(mobile): add package.json"
git add mobile/package-lock.json
git commit -m "chore(mobile): add package-lock.json"
git add mobile/tsconfig.json
git commit -m "chore(mobile): add TypeScript config"
git add mobile/babel.config.js
git commit -m "chore(mobile): add Babel config"
git add mobile/app.json
git commit -m "chore(mobile): add Expo app config"
git add mobile/index.js
git commit -m "chore(mobile): add index entry file"
git add mobile/.env.example
git commit -m "chore(mobile): add environment example file"
git add mobile/App.tsx
git commit -m "feat(mobile): add main App entry component"

git add mobile/src/api/client.ts
git commit -m "feat(mobile-core): add client.ts"
git add mobile/src/api/hooks.ts
git commit -m "feat(mobile-core): add hooks.ts"
git add mobile/src/api/types.ts
git commit -m "feat(mobile-core): add types.ts"
git add mobile/src/auth/AuthContext.tsx
git commit -m "feat(mobile-core): add AuthContext.tsx"
git add mobile/src/auth/tokenStorage.ts
git commit -m "feat(mobile-core): add tokenStorage.ts"
git add mobile/src/components/index.tsx
git commit -m "feat(mobile-core): add components index.tsx"
git add mobile/src/navigation/index.tsx
git commit -m "feat(mobile-core): add navigation index.tsx"
git add mobile/src/theme/format.ts
git commit -m "feat(mobile-core): add theme format.ts"
git add mobile/src/theme/index.ts
git commit -m "feat(mobile-core): add theme index.ts"

git checkout main
git merge --no-ff feature/mobile-core -m "merge: integrate mobile core setup"
git branch -d feature/mobile-core

Write-Host "=== BATCH 4 DONE, pushing... ==="
git push origin main

# ============================================================
# BATCH 5 -- mobile screens + final cleanup
# ============================================================
git checkout -b feature/mobile-screens
git add mobile/src/screens/AIMonitoringScreen.tsx
git commit -m "feat(mobile-screens): add AIMonitoringScreen.tsx"
git add mobile/src/screens/AlertDetailScreen.tsx
git commit -m "feat(mobile-screens): add AlertDetailScreen.tsx"
git add mobile/src/screens/AnalyticsScreen.tsx
git commit -m "feat(mobile-screens): add AnalyticsScreen.tsx"
git add mobile/src/screens/AttendanceScreen.tsx
git commit -m "feat(mobile-screens): add AttendanceScreen.tsx"
git add mobile/src/screens/CmsScreen.tsx
git commit -m "feat(mobile-screens): add CmsScreen.tsx"
git add mobile/src/screens/CompaniesScreen.tsx
git commit -m "feat(mobile-screens): add CompaniesScreen.tsx"
git add mobile/src/screens/CompanyDetailScreen.tsx
git commit -m "feat(mobile-screens): add CompanyDetailScreen.tsx"
git add mobile/src/screens/ComplaintsScreen.tsx
git commit -m "feat(mobile-screens): add ComplaintsScreen.tsx"
git add mobile/src/screens/DashboardScreen.tsx
git commit -m "feat(mobile-screens): add DashboardScreen.tsx"
git add mobile/src/screens/EditWorkerScreen.tsx
git commit -m "feat(mobile-screens): add EditWorkerScreen.tsx"
git add mobile/src/screens/EmployersScreen.tsx
git commit -m "feat(mobile-screens): add EmployersScreen.tsx"
git add mobile/src/screens/JobDetailScreen.tsx
git commit -m "feat(mobile-screens): add JobDetailScreen.tsx"
git add mobile/src/screens/JobHistoryScreen.tsx
git commit -m "feat(mobile-screens): add JobHistoryScreen.tsx"
git add mobile/src/screens/JobsScreen.tsx
git commit -m "feat(mobile-screens): add JobsScreen.tsx"
git add mobile/src/screens/MenuScreen.tsx
git commit -m "feat(mobile-screens): add MenuScreen.tsx"
git add mobile/src/screens/NotificationsScreen.tsx
git commit -m "feat(mobile-screens): add NotificationsScreen.tsx"
git add mobile/src/screens/PaymentsScreen.tsx
git commit -m "feat(mobile-screens): add PaymentsScreen.tsx"
git add mobile/src/screens/PostJobScreen.tsx
git commit -m "feat(mobile-screens): add PostJobScreen.tsx"
git add mobile/src/screens/ReportsScreen.tsx
git commit -m "feat(mobile-screens): add ReportsScreen.tsx"
git add mobile/src/screens/SecurityScreen.tsx
git commit -m "feat(mobile-screens): add SecurityScreen.tsx"
git add mobile/src/screens/SettingsScreen.tsx
git commit -m "feat(mobile-screens): add SettingsScreen.tsx"
git add mobile/src/screens/SignInScreen.tsx
git commit -m "feat(mobile-screens): add SignInScreen.tsx"
git add mobile/src/screens/SystemScreen.tsx
git commit -m "feat(mobile-screens): add SystemScreen.tsx"
git add mobile/src/screens/TransactionDetailScreen.tsx
git commit -m "feat(mobile-screens): add TransactionDetailScreen.tsx"
git add mobile/src/screens/VerificationScreen.tsx
git commit -m "feat(mobile-screens): add VerificationScreen.tsx"
git add mobile/src/screens/WorkerProfileScreen.tsx
git commit -m "feat(mobile-screens): add WorkerProfileScreen.tsx"
git add mobile/src/screens/WorkersScreen.tsx
git commit -m "feat(mobile-screens): add WorkersScreen.tsx"

git checkout main
git merge --no-ff feature/mobile-screens -m "merge: integrate all mobile screens"
git branch -d feature/mobile-screens

git add .
git commit -m "chore: add remaining uncommitted assets and configs"

Write-Host "=== BATCH 5 DONE, final push... ==="
git push origin main

Write-Host ""
Write-Host "================================================"
Write-Host "ALL DONE. Total commits on main:"
git rev-list --count HEAD
Write-Host "================================================"
