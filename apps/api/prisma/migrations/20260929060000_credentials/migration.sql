-- Verifiable credentials: the issuer registry and the credential ledger.
--
-- The `course_completions` table and the `INTRO_VIDEO` document kind appear
-- in a schema diff against a database that has not yet had the two earlier
-- migrations applied. They are deliberately left out here — they belong to
-- 20260928164036_course_completions and 20260928224337_intro_video, which
-- `migrate deploy` runs first. Repeating them would fail on the second run.

-- CreateEnum
CREATE TYPE "IssuerKind" AS ENUM ('UNIVERSITY', 'COLLEGE', 'TRAINING_CENTRE', 'EMPLOYER', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "CredentialKind" AS ENUM ('DEGREE', 'DIPLOMA', 'CERTIFICATE', 'TRAINING', 'EXPERIENCE_LETTER', 'LICENCE');

-- CreateTable
CREATE TABLE "issuers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "IssuerKind" NOT NULL,
    "did" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "website" TEXT,
    "contact" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "issuerId" UUID NOT NULL,
    "kind" "CredentialKind" NOT NULL,
    "title" TEXT NOT NULL,
    "field" TEXT,
    "grade" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "claims" JSONB,
    "contentHash" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuers_did_key" ON "issuers"("did");

-- CreateIndex
CREATE INDEX "issuers_kind_approvedAt_idx" ON "issuers"("kind", "approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_index_key" ON "credentials"("index");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_hash_key" ON "credentials"("hash");

-- CreateIndex
CREATE INDEX "credentials_subjectId_issuedAt_idx" ON "credentials"("subjectId", "issuedAt");

-- CreateIndex
CREATE INDEX "credentials_issuerId_issuedAt_idx" ON "credentials"("issuerId", "issuedAt");

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
