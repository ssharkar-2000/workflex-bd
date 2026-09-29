-- CreateEnum
CREATE TYPE "MockLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "mock_tests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "JobCategory" NOT NULL,
    "level" "MockLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "durationSeconds" INTEGER NOT NULL DEFAULT 900,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN,
    "breakdown" JSONB,
    "source" TEXT NOT NULL DEFAULT 'assembled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mock_tests_userId_createdAt_idx" ON "mock_tests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mock_tests_userId_category_idx" ON "mock_tests"("userId", "category");

-- AddForeignKey
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

