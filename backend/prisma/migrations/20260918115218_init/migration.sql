-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriberType" AS ENUM ('WORKER', 'EMPLOYER');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'MAINTENANCE';

-- AlterTable
ALTER TABLE "employers" ADD COLUMN     "balance" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "employerId" TEXT,
ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "workers" ADD COLUMN     "balance" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "subscriberType" "SubscriberType" NOT NULL,
    "workerId" TEXT,
    "employerId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "price" BIGINT NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_windows" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notified60At" TIMESTAMP(3),
    "notified30At" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "maintenance_windows_scheduledAt_idx" ON "maintenance_windows"("scheduledAt");

-- CreateIndex
CREATE INDEX "transactions_workerId_idx" ON "transactions"("workerId");

-- CreateIndex
CREATE INDEX "transactions_employerId_idx" ON "transactions"("employerId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
