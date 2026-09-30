-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR', 'GPS');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "shiftId" UUID;

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'CONFIRMED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "pay" INTEGER NOT NULL,
    "instructions" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "dressCode" TEXT,
    "requiredDocuments" TEXT[],
    "cancellationPolicy" TEXT,
    "attendanceMethod" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "basePay" INTEGER,
    "overtimePay" INTEGER,
    "bonusPay" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_workerId_startsAt_idx" ON "shifts"("workerId", "startsAt");

-- CreateIndex
CREATE INDEX "shifts_jobId_startsAt_idx" ON "shifts"("jobId", "startsAt");

-- CreateIndex
CREATE INDEX "shifts_status_startsAt_idx" ON "shifts"("status", "startsAt");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

