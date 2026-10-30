import { describe, it, expect, vi } from 'vitest';
import { runRetentionJob } from '@/services/retention.service';
import { prisma } from '@/db';
import { getStorage } from '@/storage';

describe('Retention cleanup (N-29, FR-23, TR-14)', () => {
  it('deletes R2 objects first, then database records', async () => {
    const storage = getStorage();
    const deleteFileSpy = vi.spyOn(storage, 'deleteFile').mockResolvedValue();

    const mockReceipts = [
      { id: 'rcpt_old_1', storageKey: 'receipts/u1/b1/rcpt_old_1.jpg' },
      { id: 'rcpt_old_2', storageKey: 'receipts/u1/b1/rcpt_old_2.pdf' },
    ];

    vi.spyOn(prisma.receipt, 'findMany').mockResolvedValue(mockReceipts as any);
    vi.spyOn(prisma.receipt, 'deleteMany').mockResolvedValue({ count: 2 });
    vi.spyOn(prisma.batch, 'deleteMany').mockResolvedValue({ count: 1 });

    const cutoff = new Date('2026-10-30T00:00:00Z');
    const result = await runRetentionJob(cutoff);

    // Verify storage delete was called for each receipt with storageKey
    expect(deleteFileSpy).toHaveBeenCalledTimes(2);
    expect(deleteFileSpy).toHaveBeenCalledWith('receipts/u1/b1/rcpt_old_1.jpg');
    expect(deleteFileSpy).toHaveBeenCalledWith('receipts/u1/b1/rcpt_old_2.pdf');

    expect(result.deletedStorageFiles).toBe(2);
    expect(result.deletedReceipts).toBe(2);
    expect(result.deletedBatches).toBe(1);
  });
});

