-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'NEEDS_REVIEW', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "registrationNumber" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "designation" TEXT;

-- CreateTable
CREATE TABLE "document_analyses" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "checks" JSONB,
    "ocrText" TEXT,
    "extractedName" TEXT,
    "extractedNid" TEXT,
    "extractedDob" TEXT,
    "sharpness" DOUBLE PRECISION,
    "glare" DOUBLE PRECISION,
    "cardFound" BOOLEAN,
    "facesDetected" INTEGER,
    "faceMatch" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_analyses_documentId_key" ON "document_analyses"("documentId");

-- CreateIndex
CREATE INDEX "document_analyses_status_idx" ON "document_analyses"("status");

-- AddForeignKey
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
