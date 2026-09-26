-- AlterTable
ALTER TABLE "wallet_top_ups" ADD COLUMN     "depositMethod" "PayoutMethod",
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "senderAccount" TEXT,
ALTER COLUMN "returnUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "wallet_payments" ALTER COLUMN "jobId" DROP NOT NULL,
ALTER COLUMN "jobTitle" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wallet_top_ups_depositMethod_reference_key" ON "wallet_top_ups"("depositMethod", "reference");

