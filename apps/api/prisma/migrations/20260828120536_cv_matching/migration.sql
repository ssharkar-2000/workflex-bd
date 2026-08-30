-- CreateEnum
CREATE TYPE "MatchBand" AS ENUM ('STRONG', 'GOOD', 'FAIR', 'WEAK');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'CV';

-- CreateTable
CREATE TABLE "cv_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "documentId" UUID,
    "skills" TEXT[],
    "yearsExperience" INTEGER,
    "categories" "JobCategory"[],
    "titles" TEXT[],
    "summary" TEXT,
    "rawText" TEXT,
    "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cv_profiles_userId_key" ON "cv_profiles"("userId");

-- AddForeignKey
ALTER TABLE "cv_profiles" ADD CONSTRAINT "cv_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
