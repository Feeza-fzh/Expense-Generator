import { prisma } from '../db';
import { computeReportTotals } from '../domain/totals';
import { findDuplicateFlags, ReceiptForDuplicateCheck } from '../domain/duplicates';
import { Flag } from '../domain/checks';
import { logger } from '../lib/logger';
import { Report } from '@prisma/client';

/**
 * Builds or refreshes the Report row with idempotent upsert on batchId (A-9, 6.8).
 * Checks if every receipt in batch has reached a terminal state (DONE or FAILED).
 * Returns null if batch is not complete yet.
 */
export async function buildBatchReport(batchId: string): Promise<Report | null> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      receipts: {
        include: {
          lineItems: true,
        },
      },
    },
  });

  if (!batch) {
    return null;
  }

  // N-11: Never build a report while any receipt in the batch is PENDING or PROCESSING
  const hasIncomplete = batch.receipts.some(
    (r) => r.status === 'PENDING' || r.status === 'PROCESSING'
  );

  if (hasIncomplete) {
    return null;
  }

  // Run duplicate checks for all DONE receipts in this batch against all unexpired receipts of the user (FR-11)
  const now = new Date();
  const allUserReceipts = await prisma.receipt.findMany({
    where: {
      userId: batch.userId,
      status: 'DONE',
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      fileSha256: true,
      merchantNormalized: true,
      purchaseDate: true,
      totalMinor: true,
      createdAt: true,
    },
  });

  const formattedUserReceipts: ReceiptForDuplicateCheck[] = allUserReceipts.map((r) => ({
    id: r.id,
    fileSha256: r.fileSha256,
    merchantNormalized: r.merchantNormalized,
    purchaseDate: r.purchaseDate,
    totalMinor: r.totalMinor,
    createdAt: r.createdAt,
  }));

  // Update duplicate flags on batch receipts
  for (const receipt of batch.receipts) {
    if (receipt.status !== 'DONE') continue;

    const currentFormatted: ReceiptForDuplicateCheck = {
      id: receipt.id,
      fileSha256: receipt.fileSha256,
      merchantNormalized: receipt.merchantNormalized,
      purchaseDate: receipt.purchaseDate,
      totalMinor: receipt.totalMinor,
      createdAt: receipt.createdAt,
    };

    const duplicateFlags = findDuplicateFlags(currentFormatted, formattedUserReceipts);
    if (duplicateFlags.length > 0) {
      const existingFlags = (Array.isArray(receipt.flags) ? receipt.flags : []) as Flag[];
      const mergedFlags = [...existingFlags, ...duplicateFlags];
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { flags: mergedFlags as any },
      });
      receipt.flags = mergedFlags as any;
    }
  }

  // Pure computation of totals (N-4, N-5, 6.8)
  const totals = computeReportTotals(
    batch.receipts.map((r) => ({
      id: r.id,
      currency: r.currency,
      category: r.category,
      totalMinor: r.totalMinor,
      status: r.status,
    }))
  );

  // Idempotent upsert on batchId (A-9)
  const report = await prisma.report.upsert({
    where: { batchId },
    create: {
      batchId,
      includedCount: totals.includedCount,
      totalCount: totals.totalCount,
      totals: totals as any,
    },
    update: {
      includedCount: totals.includedCount,
      totalCount: totals.totalCount,
      totals: totals as any,
      generatedAt: new Date(),
    },
  });

  logger.info('Report generated for batch', {
    batchId,
    includedCount: totals.includedCount,
    totalCount: totals.totalCount,
  });

  return report;
}
