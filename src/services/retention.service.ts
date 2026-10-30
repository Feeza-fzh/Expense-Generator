import { prisma } from '../db';
import { getStorage } from '../storage';
import { logger } from '../lib/logger';

export interface RetentionCleanupResult {
  deletedReceipts: number;
  deletedBatches: number;
  deletedStorageFiles: number;
}

/**
 * Retention cleanup job (TR-14, FR-23, Rule N-29):
 * Finds expired receipts and batches based on expiresAt index.
 * Deletes the R2 object FIRST, then deletes the database row.
 */
export async function runRetentionJob(cutoffDate = new Date()): Promise<RetentionCleanupResult> {
  const storage = getStorage();
  let deletedStorageFiles = 0;
  let deletedReceipts = 0;
  let deletedBatches = 0;

  // 1. Find expired receipts
  const expiredReceipts = await prisma.receipt.findMany({
    where: {
      expiresAt: { lt: cutoffDate },
    },
    select: {
      id: true,
      storageKey: true,
    },
  });

  // 2. Delete storage files first (N-29)
  for (const rcpt of expiredReceipts) {
    if (rcpt.storageKey) {
      try {
        await storage.deleteFile(rcpt.storageKey);
        deletedStorageFiles++;
      } catch (err) {
        logger.warn('Failed to delete storage file during retention cleanup', {
          receiptId: rcpt.id,
          storageKey: rcpt.storageKey,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 3. Delete expired receipt records
  const receiptDeleteResult = await prisma.receipt.deleteMany({
    where: {
      expiresAt: { lt: cutoffDate },
    },
  });
  deletedReceipts = receiptDeleteResult.count;

  // 4. Delete expired batches (cascades to related report and jobs)
  const batchDeleteResult = await prisma.batch.deleteMany({
    where: {
      expiresAt: { lt: cutoffDate },
    },
  });
  deletedBatches = batchDeleteResult.count;

  logger.info('Retention cleanup completed', {
    deletedStorageFiles,
    deletedReceipts,
    deletedBatches,
    cutoffDate: cutoffDate.toISOString(),
  });

  return {
    deletedStorageFiles,
    deletedReceipts,
    deletedBatches,
  };
}

