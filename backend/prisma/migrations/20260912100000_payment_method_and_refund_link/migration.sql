-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER', 'CARD', 'CASH');

-- AlterTable: default keeps existing seeded rows valid without backfill scripting
ALTER TABLE "transactions" ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'BKASH';
ALTER TABLE "transactions" ADD COLUMN "relatedTransactionId" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: give the existing seeded rows a more realistic method based on labels
UPDATE "transactions" SET "method" = 'BANK_TRANSFER' WHERE "toLabel" ILIKE '%bank%' OR "fromLabel" ILIKE '%bank%';
UPDATE "transactions" SET "method" = 'BKASH' WHERE "toLabel" ILIKE '%bkash%' OR "fromLabel" ILIKE '%bkash%';
