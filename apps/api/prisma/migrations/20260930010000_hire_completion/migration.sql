-- A recruiter confirms a hired person's work is finished. The application
-- stays ACCEPTED, so payments, reviews and trust keep counting it; the hire
-- only leaves the recruiter's hired list.
ALTER TABLE "job_applications" ADD COLUMN "completedAt" TIMESTAMP(3);

-- One review of each person per job, instead of one per job: a recruiter who
-- hired three people for the same job reviews all three. The new index is
-- built before the old one goes, so a failure leaves the old rule in place.
CREATE UNIQUE INDEX "reviews_jobId_authorId_subjectId_key" ON "reviews"("jobId", "authorId", "subjectId");
DROP INDEX "reviews_jobId_authorId_subjectRole_key";
