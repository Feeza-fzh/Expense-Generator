import { describe, it, expect, vi } from 'vitest';
import {
  checkAndRecordRateLimit,
  checkMonthlyReceiptCap,
  checkDailySpendCap,
} from '@/services/limits.service';
import { prisma } from '@/db';

describe('Rate Limits and Spend Caps (FR-21, FR-22, TR-10)', () => {
  it('throws RATE_LIMITED when 10 batch submissions are exceeded in 1 minute', async () => {
    vi.spyOn(prisma.rateLimitHit, 'count').mockResolvedValue(10);

    await expect(
      checkAndRecordRateLimit('batch', 'usr_1', 'ip_hash_1')
    ).rejects.toThrow('You are going too fast');
  });

  it('records hit and passes when under rate limit', async () => {
    vi.spyOn(prisma.rateLimitHit, 'count').mockResolvedValue(4);
    const createManySpy = vi
      .spyOn(prisma.rateLimitHit, 'createMany')
      .mockResolvedValue({ count: 2 });

    await expect(
      checkAndRecordRateLimit('batch', 'usr_1', 'ip_hash_1')
    ).resolves.toBeUndefined();
    expect(createManySpy).toHaveBeenCalled();
  });

  it('throws MONTHLY_CAP_REACHED when user exceeds 100 receipts in current month', async () => {
    vi.spyOn(prisma.receipt, 'count').mockResolvedValue(100);

    await expect(
      checkMonthlyReceiptCap('usr_1', 'ip_hash_1', 1)
    ).rejects.toThrow('You have reached this month’s limit');
  });

  it('throws DAILY_CAPACITY_REACHED when daily spend reaches spend cap', async () => {
    // 20 USD = 20,000,000 micros
    vi.spyOn(prisma.job, 'aggregate').mockResolvedValue({
      _sum: { estimatedCostMicros: 20000000 },
    } as any);

    await expect(checkDailySpendCap()).rejects.toThrow('We are at capacity for today');
  });
});

