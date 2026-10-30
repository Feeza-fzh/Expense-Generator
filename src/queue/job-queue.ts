import { prisma } from '../db';
import { appConfig } from '../../config/app.config';
import { logger } from '../lib/logger';
import { Job, JobStatus, JobType } from '@prisma/client';

export interface ClaimedJob {
  id: string;
  type: JobType;
  status: JobStatus;
  receiptId: string | null;
  batchId: string | null;
  attempts: number;
  maxAttempts: number;
}

/**
 * Reclaims expired leases (TR-8):
 * PROCESSING jobs older than queue.leaseMs (60s) return to PENDING.
 * If attempts >= maxAttempts, mark as FAILED with INTERNAL_ERROR.
 */
export async function reclaimExpiredLeases(): Promise<number> {
  const leaseCutoff = new Date(Date.now() - appConfig.queue.leaseMs);

  const expiredJobs = await prisma.job.findMany({
    where: {
      status: 'PROCESSING',
      lockedAt: { lt: leaseCutoff },
    },
  });

  let reclaimed = 0;
  for (const job of expiredJobs) {
    if (job.attempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'Worker lease expired with no attempts left.',
          finishedAt: new Date(),
        },
      });
      // If an EXTRACT job fails, update receipt status
      if (job.receiptId) {
        await prisma.receipt.update({
          where: { id: job.receiptId },
          data: {
            status: 'FAILED',
            errorCode: 'INTERNAL_ERROR',
          },
        });
      }
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          lockedAt: null,
          lockedBy: null,
        },
      });
    }
    reclaimed++;
  }

  return reclaimed;
}

/**
 * Claims up to concurrency slots using FOR UPDATE SKIP LOCKED (TR-8, A-3).
 * Enforces the concurrency cap by counting PROCESSING jobs in the database.
 */
export async function claimNextJobs(workerId: string): Promise<ClaimedJob[]> {
  return await prisma.$transaction(async (tx) => {
    // 1. Count currently PROCESSING jobs
    const currentProcessing = await tx.job.count({
      where: { status: 'PROCESSING' },
    });

    const maxConcurrency = appConfig.queue.concurrency;
    const availableSlots = maxConcurrency - currentProcessing;

    if (availableSlots <= 0) {
      return [];
    }

    // 2. Select up to availableSlots PENDING jobs
    // In PostgreSQL, FOR UPDATE SKIP LOCKED safely acquires rows without blocking
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Job"
      WHERE status = 'PENDING'::"JobStatus" AND "nextRunAt" <= NOW()
      ORDER BY "nextRunAt" ASC, "createdAt" ASC
      LIMIT ${availableSlots}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      return [];
    }

    const claimed: ClaimedJob[] = [];
    const now = new Date();

    for (const row of rows) {
      const updated = await tx.job.update({
        where: { id: row.id },
        data: {
          status: 'PROCESSING',
          lockedAt: now,
          lockedBy: workerId,
          startedAt: now,
          attempts: { increment: 1 },
        },
      });

      claimed.push({
        id: updated.id,
        type: updated.type,
        status: updated.status,
        receiptId: updated.receiptId,
        batchId: updated.batchId,
        attempts: updated.attempts,
        maxAttempts: updated.maxAttempts,
      });

      // Update receipt status if EXTRACT job
      if (updated.receiptId) {
        await tx.receipt.update({
          where: { id: updated.receiptId },
          data: { status: 'PROCESSING' },
        });
      }
    }

    return claimed;
  });
}

/**
 * Calculates nextRunAt with exponential backoff and jitter (PRD Section 6.6).
 * Backoff is 2s base, factor 2, ±25% jitter.
 */
export function calculateNextRunAt(attempts: number): Date {
  const base = appConfig.retry.backoffBaseMs;
  const factor = appConfig.retry.backoffFactor;
  const jitterPct = appConfig.retry.jitterPct / 100;

  // exponential: base * (factor ^ (attempts - 1))
  const expDelay = base * Math.pow(factor, Math.max(0, attempts - 1));
  const jitterRange = expDelay * jitterPct;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  const delayMs = Math.round(expDelay + jitter);

  return new Date(Date.now() + Math.max(0, delayMs));
}

