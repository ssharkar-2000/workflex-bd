-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('FRAUD', 'FAKE_JOB', 'MISLEADING_PAY', 'NON_PAYMENT', 'HARASSMENT', 'UNSAFE_WORK', 'FAKE_PROFILE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('SYSTEM', 'JOB', 'PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTION_TAKEN', 'DISMISSED');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID,
    "category" "ReportCategory" NOT NULL,
    "targetType" "ReportTarget" NOT NULL DEFAULT 'OTHER',
    "targetJobId" UUID,
    "targetPhone" TEXT,
    "subject" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "reviewedBy" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_category_idx" ON "reports"("category");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
