-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('HOUSEHOLD', 'DELIVERY', 'HOSPITALITY', 'RETAIL', 'OFFICE', 'IT', 'EDUCATION', 'TRADES', 'BEAUTY', 'HEALTHCARE', 'CONSTRUCTION', 'AGRICULTURE', 'EVENTS', 'TRANSPORT', 'MANUFACTURING', 'SECURITY', 'PROFESSIONAL', 'CREATIVE', 'VOLUNTEER', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY', 'ONE_TO_THREE', 'THREE_TO_FIVE', 'FIVE_PLUS');

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyId" UUID,
    "postedBy" UUID,
    "category" "JobCategory" NOT NULL,
    "jobType" "JobType" NOT NULL DEFAULT 'FULL_TIME',
    "workplaceType" "WorkplaceType" NOT NULL DEFAULT 'ONSITE',
    "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'ENTRY',
    "location" TEXT NOT NULL,
    "salaryRange" TEXT,
    "deadline" TIMESTAMP(3),
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_jobs" (
    "jobId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("jobId","userId")
);

-- CreateIndex
CREATE INDEX "jobs_isOpen_createdAt_idx" ON "jobs"("isOpen", "createdAt");

-- CreateIndex
CREATE INDEX "jobs_category_idx" ON "jobs"("category");

-- CreateIndex
CREATE INDEX "jobs_jobType_idx" ON "jobs"("jobType");

-- CreateIndex
CREATE INDEX "saved_jobs_userId_savedAt_idx" ON "saved_jobs"("userId", "savedAt");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
