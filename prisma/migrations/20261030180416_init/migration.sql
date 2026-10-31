-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('EXTRACT', 'SUMMARISE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('MEALS', 'TRAVEL', 'LODGING', 'SOFTWARE', 'OFFICE', 'UTILITIES', 'FUEL', 'MEDICAL', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Legibility" AS ENUM ('CLEAR', 'PARTIAL', 'POOR');

-- CreateEnum
CREATE TYPE "ErrorCode" AS ENUM ('UNSUPPORTED_TYPE', 'FILE_TOO_LARGE', 'EMPTY_FILE', 'UNREADABLE_FILE', 'NOT_A_RECEIPT', 'PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'INVALID_MODEL_OUTPUT', 'INTERNAL_ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" "ErrorCode",
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileSha256" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "pageCount" INTEGER,
    "merchant" TEXT,
    "merchantNormalized" TEXT,
    "purchaseDate" DATE,
    "dateRaw" TEXT,
    "dateAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3),
    "subtotalMinor" INTEGER,
    "taxMinor" INTEGER,
    "tipMinor" INTEGER,
    "totalMinor" INTEGER,
    "pricesIncludeTax" BOOLEAN,
    "paymentMethod" TEXT,
    "category" "Category",
    "legibility" "Legibility",
    "receiptCountDetected" INTEGER,
    "languageCode" TEXT,
    "flags" JSONB NOT NULL DEFAULT '[]',
    "rawModelOutput" JSONB,
    "modelId" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3),
    "amountMinor" INTEGER,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "receiptId" TEXT,
    "batchId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" "ErrorCode",
    "errorMessage" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostMicros" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "includedCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "totals" JSONB NOT NULL,
    "summary" JSONB,
    "summaryStatus" "SummaryStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "summaryModelId" TEXT,
    "summaryPromptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Batch_userId_createdAt_idx" ON "Batch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Batch_ipHash_createdAt_idx" ON "Batch"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Batch_expiresAt_idx" ON "Batch"("expiresAt");

-- CreateIndex
CREATE INDEX "Receipt_userId_fileSha256_idx" ON "Receipt"("userId", "fileSha256");

-- CreateIndex
CREATE INDEX "Receipt_userId_merchantNormalized_purchaseDate_totalMinor_idx" ON "Receipt"("userId", "merchantNormalized", "purchaseDate", "totalMinor");

-- CreateIndex
CREATE INDEX "Receipt_batchId_status_idx" ON "Receipt"("batchId", "status");

-- CreateIndex
CREATE INDEX "Receipt_expiresAt_idx" ON "Receipt"("expiresAt");

-- CreateIndex
CREATE INDEX "LineItem_receiptId_position_idx" ON "LineItem"("receiptId", "position");

-- CreateIndex
CREATE INDEX "Job_status_nextRunAt_idx" ON "Job"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "Job_batchId_type_idx" ON "Job"("batchId", "type");

-- CreateIndex
CREATE INDEX "Job_finishedAt_idx" ON "Job"("finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_batchId_key" ON "Report"("batchId");

-- CreateIndex
CREATE INDEX "Report_generatedAt_idx" ON "Report"("generatedAt");

-- CreateIndex
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
