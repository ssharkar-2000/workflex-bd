BEGIN;
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


CREATE SEQUENCE "wallet_public_id_seq" MAXVALUE 9999999999;
ALTER TABLE "wallets" ADD COLUMN "publicId" TEXT NOT NULL DEFAULT ('WF-' || lpad(nextval('wallet_public_id_seq')::text, 10, '0'));
CREATE UNIQUE INDEX "wallets_publicId_key" ON "wallets"("publicId");
CREATE INDEX "wallet_payments_payeeId_createdAt_id_idx" ON "wallet_payments"("payeeId", "createdAt", "id");

COMMIT;
