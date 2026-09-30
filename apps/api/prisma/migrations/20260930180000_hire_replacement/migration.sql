-- CreateEnum
CREATE TYPE "HireUnavailableReason" AS ENUM ('DROPPED_OUT', 'SICK', 'NO_SHOW', 'OTHER');

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "replacedAt" TIMESTAMP(3),
ADD COLUMN     "replacedByUserId" UUID,
ADD COLUMN     "replacesUserId" UUID,
ADD COLUMN     "unavailableAt" TIMESTAMP(3),
ADD COLUMN     "unavailableBy" "ReviewRole",
ADD COLUMN     "unavailableNote" TEXT,
ADD COLUMN     "unavailableReason" "HireUnavailableReason";

