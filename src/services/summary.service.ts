import { prisma } from '../db';
import { AppError } from '../lib/errors';
import { checkAndRecordRateLimit } from './limits.service';
import { hashIp } from '../lib/security';
import { appConfig } from '../../config/app.config';

export async function requestBatchSummary(
  batchId: string,
  userId: string,
  clientIp: string
): Promise<{ status: string }> {
  // 1. Verify ownership (N-20: 404 for another user's data)
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      report: true,
      receipts: true,
    },
  });

  if (!batch || batch.userId !== userId) {
    throw new AppError('INTERNAL_ERROR', 404);
  }

  // 2. Check report exists
  if (!batch.report) {
    throw new AppError('INTERNAL_ERROR', 404);
  }

  // 3. FR-19: Summary is unavailable when report has 0 done receipts
  const doneCount = batch.receipts.filter((r) => r.status === 'DONE').length;
  if (doneCount === 0) {
    throw new AppError('NO_FILES', 400); // Or disabled action explanation
  }

  // 4. TR-11: 409 if a summary exists and has not failed
  if (batch.report.summaryStatus === 'DONE') {
    throw new AppError('INTERNAL_ERROR', 409);
  }

  if (batch.report.summaryStatus === 'PENDING' || batch.report.summaryStatus === 'PROCESSING') {
    return { status: batch.report.summaryStatus };
  }

  // 5. Rate limit check (5 follow-ups per min)
  const ipHash = hashIp(clientIp);
  await checkAndRecordRateLimit('summary', userId, ipHash);

  // 6. Create SUMMARISE job
  await prisma.job.create({
    data: {
      type: 'SUMMARISE',
      status: 'PENDING',
      batchId: batch.id,
      maxAttempts: appConfig.retry.maxAttempts,
      nextRunAt: new Date(),
    },
  });

  // Update report summaryStatus to PENDING
  await prisma.report.update({
    where: { batchId },
    data: { summaryStatus: 'PENDING' },
  });

  return { status: 'PENDING' };
}

