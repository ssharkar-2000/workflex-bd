-- AlterEnum: add ESCALATED status for complaints
ALTER TYPE "ComplaintStatus" ADD VALUE 'ESCALATED';

-- AlterTable: track who a complaint is assigned to
ALTER TABLE "complaints" ADD COLUMN "assignedAdminId" TEXT;

-- CreateTable: reply thread on complaints
CREATE TABLE "complaint_replies" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "complaint_replies_complaintId_idx" ON "complaint_replies"("complaintId");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaint_replies" ADD CONSTRAINT "complaint_replies_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaint_replies" ADD CONSTRAINT "complaint_replies_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
