-- ---------------------------------------------------------------------------
-- Items 7-14: user-facing messages, 24h ban notices, interview list,
-- document storage (user id + job id), alert -> company manager routing,
-- and instant support auto-replies.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "ReplyAuthor" AS ENUM ('ADMIN', 'USER', 'SYSTEM');
CREATE TYPE "UserNotificationKind" AS ENUM ('JOB_REJECTED', 'BAN_WARNING', 'BAN_APPLIED', 'BAN_CANCELLED', 'SUPPORT_REPLY', 'ALERT_ESCALATION', 'INTERVIEW', 'GENERAL');
CREATE TYPE "UserAudience" AS ENUM ('WORKER', 'EMPLOYER');
CREATE TYPE "BanStatus" AS ENUM ('SCHEDULED', 'EXECUTED', 'CANCELLED');
CREATE TYPE "InterviewMode" AS ENUM ('IN_PERSON', 'PHONE', 'VIDEO');
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "DocumentOwnerType" AS ENUM ('WORKER', 'EMPLOYER');
CREATE TYPE "DocumentKind" AS ENUM ('NID', 'PASSPORT', 'BIRTH_CERTIFICATE', 'CERTIFICATE', 'CV', 'CONTRACT', 'PHOTO', 'TRADE_LICENSE', 'OTHER');

-- Item 12: employers can be flagged as their company's escalation contact
ALTER TABLE "employers" ADD COLUMN "isManager" BOOLEAN NOT NULL DEFAULT false;

-- Item 12/13: where a suspicious-activity alert came from, and who it went to
ALTER TABLE "alerts" ADD COLUMN "companyId" TEXT;
ALTER TABLE "alerts" ADD COLUMN "companyLabel" TEXT;
ALTER TABLE "alerts" ADD COLUMN "escalatedToEmployerId" TEXT;
ALTER TABLE "alerts" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "alerts" ADD COLUMN "escalationNote" TEXT;

CREATE INDEX "alerts_companyId_idx" ON "alerts"("companyId");

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_escalatedToEmployerId_fkey" FOREIGN KEY ("escalatedToEmployerId") REFERENCES "employers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Item 9: the help thread now carries user messages and system auto-replies,
-- so adminId becomes nullable and every row says who wrote it.
ALTER TABLE "complaint_replies" DROP CONSTRAINT "complaint_replies_adminId_fkey";
ALTER TABLE "complaint_replies" ALTER COLUMN "adminId" DROP NOT NULL;
ALTER TABLE "complaint_replies" ADD COLUMN "authorType" "ReplyAuthor" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "complaint_replies" ADD COLUMN "authorName" TEXT;
ALTER TABLE "complaint_replies" ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaint_replies" ADD CONSTRAINT "complaint_replies_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaints" ADD COLUMN "reporterWorkerId" TEXT;
ALTER TABLE "complaints" ADD COLUMN "reporterEmployerId" TEXT;
ALTER TABLE "complaints" ADD COLUMN "autoRepliedAt" TIMESTAMP(3);

-- Items 7/8/9/10/12: every message addressed to an end user
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "kind" "UserNotificationKind" NOT NULL,
    "audience" "UserAudience" NOT NULL,
    "workerId" TEXT,
    "employerId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reason" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_notifications_workerId_read_idx" ON "user_notifications"("workerId", "read");
CREATE INDEX "user_notifications_employerId_read_idx" ON "user_notifications"("employerId", "read");
CREATE INDEX "user_notifications_createdAt_idx" ON "user_notifications"("createdAt");

ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Item 8: 24-hour ban notices
CREATE TABLE "scheduled_bans" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "noticeText" TEXT NOT NULL,
    "status" "BanStatus" NOT NULL DEFAULT 'SCHEDULED',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "triggerTransactionId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_bans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_bans_status_effectiveAt_idx" ON "scheduled_bans"("status", "effectiveAt");
CREATE INDEX "scheduled_bans_workerId_idx" ON "scheduled_bans"("workerId");

ALTER TABLE "scheduled_bans" ADD CONSTRAINT "scheduled_bans_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Item 10: interview list
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "mode" "InterviewMode" NOT NULL DEFAULT 'IN_PERSON',
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "interviewerName" TEXT,
    "notes" TEXT,
    "outcome" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interviews_status_scheduledAt_idx" ON "interviews"("status", "scheduledAt");
CREATE INDEX "interviews_jobId_idx" ON "interviews"("jobId");
CREATE INDEX "interviews_workerId_idx" ON "interviews"("workerId");

ALTER TABLE "interviews" ADD CONSTRAINT "interviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Item 11: document storage keyed on user id + job id
CREATE TABLE "stored_documents" (
    "id" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "workerId" TEXT,
    "employerId" TEXT,
    "jobId" TEXT,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "note" TEXT,
    "uploadedByAdminId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stored_documents_storageKey_key" ON "stored_documents"("storageKey");
CREATE INDEX "stored_documents_workerId_jobId_idx" ON "stored_documents"("workerId", "jobId");
CREATE INDEX "stored_documents_employerId_jobId_idx" ON "stored_documents"("employerId", "jobId");

ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stored_documents" ADD CONSTRAINT "stored_documents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
