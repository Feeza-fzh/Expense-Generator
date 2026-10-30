import { prisma } from '../db';
import { appConfig } from '../../config/app.config';
import { AppError } from '../lib/errors';

export async function checkAndRecordRateLimit(
  action: 'batch' | 'summary',
  userId: string,
  ipHash: string
): Promise<void> {
  const maxPerMinute =
    action === 'batch'
      ? appConfig.limits.batchSubmissionsPerMinute
      : appConfig.limits.followUpsPerMinute;

  const oneMinuteAgo = new Date(Date.now() - 60000);
  const cookieKey = `${action}:cookie:${userId}`;
  const ipKey = `${action}:ip:${ipHash}`;

  // Check rate limit for cookie
  const cookieHits = await prisma.rateLimitHit.count({
    where: {
      key: cookieKey,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (cookieHits >= maxPerMinute) {
    throw new AppError('RATE_LIMITED', 429);
  }

  // Check rate limit for IP
  const ipHits = await prisma.rateLimitHit.count({
    where: {
      key: ipKey,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (ipHits >= maxPerMinute) {
    throw new AppError('RATE_LIMITED', 429);
  }

  // Record hits for both
  await prisma.rateLimitHit.createMany({
    data: [
      { key: cookieKey, createdAt: new Date() },
      { key: ipKey, createdAt: new Date() },
    ],
  });
}

export async function checkMonthlyReceiptCap(
  userId: string,
  ipHash: string,
  incomingCount = 1
): Promise<void> {
  const now = new Date();
  const startOfMonthUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  const maxCap = appConfig.limits.monthlyReceiptCap;

  // Count receipts this month for user
  const userReceiptCount = await prisma.receipt.count({
    where: {
      userId,
      createdAt: { gte: startOfMonthUtc },
    },
  });

  if (userReceiptCount + incomingCount > maxCap) {
    throw new AppError('MONTHLY_CAP_REACHED', 429);
  }

  // Count receipts this month for IP (via batch relation)
  const ipReceiptCount = await prisma.receipt.count({
    where: {
      batch: { ipHash },
      createdAt: { gte: startOfMonthUtc },
    },
  });

  if (ipReceiptCount + incomingCount > maxCap) {
    throw new AppError('MONTHLY_CAP_REACHED', 429);
  }
}

export async function checkDailySpendCap(): Promise<void> {
  const now = new Date();
  const startOfDayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  const maxSpendMicros = appConfig.limits.dailySpendCapUsd * 1000000;

  const result = await prisma.job.aggregate({
    _sum: {
      estimatedCostMicros: true,
    },
    where: {
      finishedAt: { gte: startOfDayUtc },
    },
  });

  const currentSpendMicros = result._sum.estimatedCostMicros ?? 0;
  if (currentSpendMicros >= maxSpendMicros) {
    throw new AppError('DAILY_CAPACITY_REACHED', 503);
  }
}

