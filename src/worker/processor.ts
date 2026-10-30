import { prisma } from '../db';
import { getStorage } from '../storage';
import { getAiAdapter } from '../ai/gemini-adapter';
import { appConfig } from '../../config/app.config';
import { parseAmountToMinor } from '../domain/money';
import { normalizeMerchant } from '../domain/merchant';
import { runReceiptChecks } from '../domain/checks';
import { validateSummariserOutput } from '../domain/summary-check';
import { buildBatchReport } from '../services/report.service';
import { ClaimedJob, calculateNextRunAt } from '../queue/job-queue';
import { AppError, getReceiptErrorMessage, RECEIPT_ERROR_MESSAGES, ReceiptErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { Category, Legibility, ErrorCode } from '@prisma/client';

export async function processJob(job: ClaimedJob): Promise<void> {
  const startTime = Date.now();
  logger.info('Processing job', {
    jobId: job.id,
    type: job.type,
    attempts: job.attempts,
    receiptId: job.receiptId ?? undefined,
    batchId: job.batchId ?? undefined,
  });

  try {
    if (job.type === 'EXTRACT') {
      await processExtractJob(job);
    } else if (job.type === 'SUMMARISE') {
      await processSummariseJob(job);
    }
  } catch (err: unknown) {
    await handleJobError(job, err, startTime);
  }
}

async function processExtractJob(job: ClaimedJob): Promise<void> {
  if (!job.receiptId) {
    throw new AppError('INTERNAL_ERROR', 500);
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: job.receiptId },
  });

  if (!receipt || !receipt.storageKey) {
    throw new AppError('INTERNAL_ERROR', 500);
  }

  const storage = getStorage();
  const ai = getAiAdapter();

  // 1. Fetch file from storage
  const fileBuffer = await storage.getFileBuffer(receipt.storageKey);

  // 2. Call Extractor role
  const result = await ai.extractReceipt(fileBuffer, receipt.mimeType || 'image/jpeg');
  const extracted = result.data;

  // 3. Check NOT_A_RECEIPT (6.6: receiptCountDetected === 0 fails immediately, no retry)
  if (extracted.receiptCountDetected === 0) {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: 'FAILED',
        errorCode: 'NOT_A_RECEIPT',
        receiptCountDetected: 0,
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorCode: 'NOT_A_RECEIPT',
        errorMessage: getReceiptErrorMessage('NOT_A_RECEIPT'),
        finishedAt: new Date(),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostMicros: result.estimatedCostMicros,
      },
    });

    if (job.batchId) {
      await buildBatchReport(job.batchId);
    }
    return;
  }

  // 4. Money parsing: convert decimal strings to integer minor units (N-2, N-4)
  const currency = extracted.currency ? extracted.currency.toUpperCase() : null;
  const subtotalMinor = parseAmountToMinor(extracted.subtotal, currency);
  const taxMinor = parseAmountToMinor(extracted.tax, currency);
  const tipMinor = parseAmountToMinor(extracted.tip, currency);
  const totalMinor = parseAmountToMinor(extracted.total, currency);

  // 5. Merchant normalization
  const merchantNormalized = normalizeMerchant(extracted.merchant);

  // 6. Line items parsing
  const lineItemsData = (extracted.lineItems ?? []).map((item, idx) => ({
    position: idx + 1,
    description: item.description,
    quantity: item.quantity ? parseFloat(item.quantity) : null,
    amountMinor: parseAmountToMinor(item.amount, currency),
  }));

  // 7. Run code checks & flags (6.5)
  const flags = runReceiptChecks(
    {
      merchant: extracted.merchant,
      date: extracted.date,
      dateRaw: extracted.dateRaw,
      dateAmbiguous: extracted.dateAmbiguous,
      currency,
      subtotalMinor,
      taxMinor,
      tipMinor,
      totalMinor,
      pricesIncludeTax: extracted.pricesIncludeTax,
      legibility: extracted.legibility,
      receiptCountDetected: extracted.receiptCountDetected,
      languageCode: extracted.languageCode,
      lineItems: lineItemsData,
    },
    {
      amountToleranceMinor: appConfig.checks.amountToleranceMinor,
      futureDateAllowanceDays: appConfig.checks.futureDateAllowanceDays,
    }
  );

  // 8. Map category & legibility to Prisma enums
  const categoryEnum = extracted.category
    ? (extracted.category.toUpperCase() as Category)
    : Category.UNKNOWN;
  const legibilityEnum = extracted.legibility
    ? (extracted.legibility.toUpperCase() as Legibility)
    : Legibility.CLEAR;

  const purchaseDate = extracted.date ? new Date(`${extracted.date}T00:00:00.000Z`) : null;

  // 9. Save checked data to Database
  await prisma.$transaction(async (tx) => {
    // Save line items
    if (lineItemsData.length > 0) {
      await tx.lineItem.deleteMany({ where: { receiptId: receipt.id } });
      await tx.lineItem.createMany({
        data: lineItemsData.map((li) => ({
          receiptId: receipt.id,
          position: li.position,
          description: li.description,
          quantity: li.quantity !== null && !isNaN(li.quantity) ? li.quantity : null,
          amountMinor: li.amountMinor,
        })),
      });
    }

    // Update receipt
    await tx.receipt.update({
      where: { id: receipt.id },
      data: {
        status: 'DONE',
        errorCode: null,
        merchant: extracted.merchant,
        merchantNormalized,
        purchaseDate,
        dateRaw: extracted.dateRaw,
        dateAmbiguous: extracted.dateAmbiguous,
        currency,
        subtotalMinor,
        taxMinor,
        tipMinor,
        totalMinor,
        pricesIncludeTax: extracted.pricesIncludeTax,
        paymentMethod: extracted.paymentMethod,
        category: categoryEnum,
        legibility: legibilityEnum,
        receiptCountDetected: extracted.receiptCountDetected,
        languageCode: extracted.languageCode,
        flags: flags as any,
        rawModelOutput: extracted as any,
        modelId: result.modelId,
        promptVersion: result.promptVersion,
      },
    });

    // Update job to DONE
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostMicros: result.estimatedCostMicros,
      },
    });
  });

  // 10. Check if batch report can be built (6.8, A-9)
  if (job.batchId) {
    await buildBatchReport(job.batchId);
  }
}

async function processSummariseJob(job: ClaimedJob): Promise<void> {
  if (!job.batchId) {
    throw new AppError('INTERNAL_ERROR', 500);
  }

  const batch = await prisma.batch.findUnique({
    where: { id: job.batchId },
    include: {
      report: true,
      receipts: true,
    },
  });

  if (!batch || !batch.report) {
    throw new AppError('INTERNAL_ERROR', 500);
  }

  const ai = getAiAdapter();

  // A-4: Give the Summariser text only. Never give it an image.
  // Shape the batch summary input
  const summaryPayload = {
    batchId: batch.id,
    totals: batch.report.totals,
    receipts: batch.receipts
      .filter((r) => r.status === 'DONE')
      .map((r) => ({
        id: r.id,
        category: r.category,
        flags: r.flags,
      })),
  };

  const reportJsonText = JSON.stringify(summaryPayload);
  const validReceiptIds = new Set(batch.receipts.map((r) => r.id));

  // Call Summariser role
  const result = await ai.summariseBatch(reportJsonText);

  // Validate output against PRD 6.7 rules (N-7: no money amounts in notes, exactly one BATCH_OVERVIEW)
  const validation = validateSummariserOutput(result.data, validReceiptIds);

  if (!validation.valid) {
    logger.warn('Summariser output failed code check, retrying once with error appended', {
      error: validation.error,
    });
    // Retry once with error appended (PRD 6.7)
    const retryResult = await ai.summariseBatch(reportJsonText, validation.error);
    const retryValidation = validateSummariserOutput(retryResult.data, validReceiptIds);

    if (!retryValidation.valid) {
      // Second failure sets summaryStatus to FAILED (FR-19, 6.7)
      await prisma.report.update({
        where: { batchId: batch.id },
        data: { summaryStatus: 'FAILED' },
      });
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorCode: 'INVALID_MODEL_OUTPUT',
          errorMessage: getReceiptErrorMessage('INVALID_MODEL_OUTPUT'),
          finishedAt: new Date(),
        },
      });
      return;
    }

    // Success on retry
    await prisma.report.update({
      where: { batchId: batch.id },
      data: {
        summary: retryResult.data as any,
        summaryStatus: 'DONE',
        summaryModelId: retryResult.modelId,
        summaryPromptVersion: retryResult.promptVersion,
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
        inputTokens: retryResult.inputTokens,
        outputTokens: retryResult.outputTokens,
        estimatedCostMicros: retryResult.estimatedCostMicros,
      },
    });
    return;
  }

  // Success on first attempt
  await prisma.report.update({
    where: { batchId: batch.id },
    data: {
      summary: result.data as any,
      summaryStatus: 'DONE',
      summaryModelId: result.modelId,
      summaryPromptVersion: result.promptVersion,
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'DONE',
      finishedAt: new Date(),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostMicros: result.estimatedCostMicros,
    },
  });
}

async function handleJobError(job: ClaimedJob, err: unknown, startTime: number): Promise<void> {
  const latencyMs = Date.now() - startTime;
  const errorCode: ReceiptErrorCode =
    err instanceof AppError && err.code in RECEIPT_ERROR_MESSAGES
      ? (err.code as ReceiptErrorCode)
      : 'INTERNAL_ERROR';

  logger.error('Job execution failed', {
    jobId: job.id,
    type: job.type,
    errorCode,
    attempts: job.attempts,
    latencyMs,
    message: err instanceof Error ? err.message : String(err),
  });

  const isNonRetryable = errorCode === 'UNREADABLE_FILE' || errorCode === 'NOT_A_RECEIPT';
  const hasAttemptsLeft = job.attempts < job.maxAttempts && !isNonRetryable;

  if (hasAttemptsLeft) {
    const nextRunAt = calculateNextRunAt(job.attempts);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        lockedAt: null,
        lockedBy: null,
        nextRunAt,
        errorCode,
        errorMessage: getReceiptErrorMessage(errorCode),
      },
    });
    // If extract job, return receipt to PENDING
    if (job.receiptId) {
      await prisma.receipt.update({
        where: { id: job.receiptId },
        data: { status: 'PENDING' },
      });
    }
  } else {
    // Final failure (PRD 6.6)
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorCode,
        errorMessage: getReceiptErrorMessage(errorCode),
        finishedAt: new Date(),
      },
    });

    if (job.receiptId) {
      await prisma.receipt.update({
        where: { id: job.receiptId },
        data: {
          status: 'FAILED',
          errorCode,
        },
      });
    }

    if (job.type === 'SUMMARISE' && job.batchId) {
      await prisma.report.update({
        where: { batchId: job.batchId },
        data: { summaryStatus: 'FAILED' },
      });
    }

    // Trigger batch report check if EXTRACT job
    if (job.type === 'EXTRACT' && job.batchId) {
      await buildBatchReport(job.batchId);
    }
  }
}
