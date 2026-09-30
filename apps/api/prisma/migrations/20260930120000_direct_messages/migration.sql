-- Direct messages: a conversation between two accounts that is not about a
-- job, started by typing the other person's WorkFlex id.
--
-- A direct thread has no job, so the column becomes optional. `directKey`
-- holds both account ids, sorted, so two people only ever have one direct
-- thread whichever of them wrote first. Job threads leave it null, and
-- Postgres treats nulls as distinct, so the unique index never touches them —
-- nor does the existing (jobId, workerId) index touch direct threads.

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "directKey" TEXT,
ALTER COLUMN "jobId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_directKey_key" ON "conversations"("directKey");
