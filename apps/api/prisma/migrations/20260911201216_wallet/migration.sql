-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('TOP_UP', 'PAYMENT_SENT', 'PAYMENT_RECEIVED', 'WITHDRAWAL', 'WITHDRAWAL_RETURNED');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'HELD', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BKASH', 'NAGAD', 'BANK');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "withdrawable" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "topUpId" UUID,
    "paymentId" UUID,
    "withdrawalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_top_ups" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT NOT NULL,
    "tranId" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "valId" TEXT,
    "bankTranId" TEXT,
    "method" TEXT,
    "riskLevel" INTEGER,
    "riskTitle" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_top_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_payments" (
    "id" UUID NOT NULL,
    "payerId" UUID NOT NULL,
    "payeeId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_withdrawals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "branchName" TEXT,
    "routingNumber" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" UUID NOT NULL,
    "payoutReference" TEXT,
    "rejectReason" TEXT,
    "processedBy" UUID,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallet_entries_walletId_createdAt_idx" ON "wallet_entries"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_top_ups_tranId_key" ON "wallet_top_ups"("tranId");

-- CreateIndex
CREATE INDEX "wallet_top_ups_userId_createdAt_idx" ON "wallet_top_ups"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_top_ups_status_createdAt_idx" ON "wallet_top_ups"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_payments_requestId_key" ON "wallet_payments"("requestId");

-- CreateIndex
CREATE INDEX "wallet_payments_payerId_createdAt_idx" ON "wallet_payments"("payerId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_payments_payeeId_createdAt_idx" ON "wallet_payments"("payeeId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_payments_jobId_payeeId_idx" ON "wallet_payments"("jobId", "payeeId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_withdrawals_requestId_key" ON "wallet_withdrawals"("requestId");

-- CreateIndex
CREATE INDEX "wallet_withdrawals_userId_createdAt_idx" ON "wallet_withdrawals"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_withdrawals_status_createdAt_idx" ON "wallet_withdrawals"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "wallet_top_ups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "wallet_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "wallet_withdrawals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_payments" ADD CONSTRAINT "wallet_payments_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_payments" ADD CONSTRAINT "wallet_payments_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The ledger's invariants, enforced by the database itself so that no bug in
-- the application can break them: a balance never goes negative, and the
-- withdrawable part never exceeds it. Prisma does not model CHECK
-- constraints, so they live here rather than in schema.prisma.
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_check" CHECK ("balance" >= 0 AND "withdrawable" >= 0 AND "withdrawable" <= "balance");
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_amount_check" CHECK ("amount" > 0);
ALTER TABLE "wallet_payments" ADD CONSTRAINT "wallet_payments_amount_check" CHECK ("amount" > 0 AND "payerId" <> "payeeId");
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_amount_check" CHECK ("amount" > 0);
-- Every entry has exactly one cause.
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_one_cause_check" CHECK (num_nonnulls("topUpId", "paymentId", "withdrawalId") = 1);
