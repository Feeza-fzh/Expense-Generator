import path from 'path';
import { prisma } from '../db';
import { appConfig } from '../../config/app.config';
import { getStorage, buildStorageKey } from '../storage';
import { validateReceiptFile } from '../lib/file-validator';
import { AppError, getReceiptErrorMessage } from '../lib/errors';
import { checkAndRecordRateLimit, checkMonthlyReceiptCap, checkDailySpendCap } from './limits.service';
import { hashIp, signUserId } from '../lib/security';
import { logger } from '../lib/logger';
import { ReceiptStatus } from '@prisma/client';

export interface UploadFileInput {
  filename: string;
  buffer: Buffer;
}

export interface UploadBatchResult {
  batchId: string;
  userId: string;
  signedCookieValue: string;
  receipts: Array<{
    id: string;
    originalFilename: string;
    status: ReceiptStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
}

export async function processBatchUpload(
  files: UploadFileInput[],
  existingUserId: string | null,
  clientIp: string
): Promise<UploadBatchResult> {
  // 1. Request-level validation: file count (FR-2, TR-12)
  if (!files || files.length === 0) {
    throw new AppError('NO_FILES', 400);
  }

  if (files.length > appConfig.upload.maxFilesPerBatch) {
    throw new AppError('BATCH_TOO_LARGE', 400);
  }

  const ipHash = hashIp(clientIp);

  // 2. Identify or create User (FR-20)
  let user = existingUserId
    ? await prisma.user.findUnique({ where: { id: existingUserId } })
    : null;

  if (!user) {
    user = await prisma.user.create({
      data: {
        lastSeenAt: new Date(),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const userId = user.id;
  const signedCookieValue = signUserId(userId);

  // 3. Rate limits and Cap checks (N-28, FR-21, FR-22, TR-10)
  await checkAndRecordRateLimit('batch', userId, ipHash);
  await checkDailySpendCap();
  await checkMonthlyReceiptCap(userId, ipHash, files.length);

  // 4. Create Batch record
  const now = new Date();
  const expiresAt = new Date(now.getTime() + appConfig.retention.days * 24 * 60 * 60 * 1000);

  const batch = await prisma.batch.create({
    data: {
      userId,
      ipHash,
      createdAt: now,
      expiresAt,
    },
  });

  const storage = getStorage();
  const receiptResults: UploadBatchResult['receipts'] = [];

  // 5. Process each file
  for (const file of files) {
    const validation = validateReceiptFile(file.buffer);

    if (!validation.valid) {
      // FR-4, N-12: Rejected file still appears in the batch as a FAILED receipt with its error code. Never stored in R2.
      const errorCode = validation.errorCode || 'INTERNAL_ERROR';
      const receipt = await prisma.receipt.create({
        data: {
          batchId: batch.id,
          userId,
          status: 'FAILED',
          errorCode,
          originalFilename: file.filename,
          sizeBytes: validation.sizeBytes ?? file.buffer.length,
          pageCount: validation.pageCount,
          expiresAt,
        },
      });

      receiptResults.push({
        id: receipt.id,
        originalFilename: file.filename,
        status: 'FAILED',
        errorCode,
        errorMessage: getReceiptErrorMessage(errorCode),
      });

      logger.info('File rejected during upload', {
        batchId: batch.id,
        receiptId: receipt.id,
        errorCode,
      });
    } else {
      // Valid file: create receipt, store to R2, create EXTRACT job
      const receipt = await prisma.receipt.create({
        data: {
          batchId: batch.id,
          userId,
          status: 'PENDING',
          originalFilename: file.filename,
          mimeType: validation.mimeType,
          sizeBytes: validation.sizeBytes,
          pageCount: validation.pageCount,
          fileSha256: validation.fileSha256,
          expiresAt,
        },
      });

      const ext = path.extname(file.filename) || (validation.mimeType === 'application/pdf' ? '.pdf' : '.jpg');
      const storageKey = buildStorageKey(userId, batch.id, receipt.id, ext);

      // Upload to R2 / MinIO
      await storage.uploadFile(storageKey, file.buffer, validation.mimeType!);

      // Update receipt with storage key
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { storageKey },
      });

      // Queue EXTRACT job
      await prisma.job.create({
        data: {
          type: 'EXTRACT',
          status: 'PENDING',
          receiptId: receipt.id,
          batchId: batch.id,
          maxAttempts: appConfig.retry.maxAttempts,
          nextRunAt: now,
        },
      });

      receiptResults.push({
        id: receipt.id,
        originalFilename: file.filename,
        status: 'PENDING',
      });
    }
  }

  // If all files in batch were rejected (all FAILED), trigger report creation immediately
  const allRejected = receiptResults.every((r) => r.status === 'FAILED');
  if (allRejected) {
    const { buildBatchReport } = await import('./report.service');
    await buildBatchReport(batch.id);
  }

  return {
    batchId: batch.id,
    userId,
    signedCookieValue,
    receipts: receiptResults,
  };
}

