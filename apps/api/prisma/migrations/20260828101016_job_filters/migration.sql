-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'FIXED_PROJECT', 'NEGOTIABLE');

-- CreateEnum
CREATE TYPE "WorkingTime" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "HoursBand" AS ENUM ('H2_3', 'H4_6', 'H6_8', 'H8_PLUS');

-- CreateEnum
CREATE TYPE "JobDuration" AS ENUM ('ONE_TIME', 'ONE_DAY', 'FEW_DAYS', 'ONE_WEEK', 'ONE_MONTH', 'THREE_TO_SIX_MONTHS', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('IMMEDIATE', 'WITHIN_24H', 'WITHIN_3_DAYS', 'THIS_WEEK', 'NONE');

-- CreateEnum
CREATE TYPE "Division" AS ENUM ('BARISHAL', 'CHATTOGRAM', 'DHAKA', 'KHULNA', 'MYMENSINGH', 'RAJSHAHI', 'RANGPUR', 'SYLHET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'PERMANENT';
ALTER TYPE "JobType" ADD VALUE 'FREELANCE';
ALTER TYPE "JobType" ADD VALUE 'SEASONAL';
ALTER TYPE "JobType" ADD VALUE 'SHIFT_BASED';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "district" TEXT,
ADD COLUMN     "division" "Division",
ADD COLUMN     "duration" "JobDuration" NOT NULL DEFAULT 'LONG_TERM',
ADD COLUMN     "flexibleStart" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hoursBand" "HoursBand",
ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "urgency" "Urgency" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "workingTime" "WorkingTime" NOT NULL DEFAULT 'FLEXIBLE';

-- CreateIndex
CREATE INDEX "jobs_urgency_idx" ON "jobs"("urgency");

-- CreateIndex
CREATE INDEX "jobs_duration_idx" ON "jobs"("duration");

-- CreateIndex
CREATE INDEX "jobs_division_district_idx" ON "jobs"("division", "district");
