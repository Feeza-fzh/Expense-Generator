import { describe, it, expect } from 'vitest';
import {
  buildStorageKey,
  MockStorageAdapter,
} from '@/storage';

describe('Storage (TR-5, N-21, N-22)', () => {
  it('builds storage keys conforming to receipts/{userId}/{batchId}/{receiptId}.{ext}', () => {
    const key = buildStorageKey('usr_1', 'batch_2', 'rcpt_3', '.jpg');
    expect(key).toBe('receipts/usr_1/batch_2/rcpt_3.jpg');

    const keyWithoutDot = buildStorageKey('usr_1', 'batch_2', 'rcpt_3', 'pdf');
    expect(keyWithoutDot).toBe('receipts/usr_1/batch_2/rcpt_3.pdf');
  });

  it('stores and retrieves file buffers in memory storage adapter', async () => {
    const storage = new MockStorageAdapter();
    const testBuffer = Buffer.from('test-receipt-content');
    const key = 'receipts/u/b/r.png';

    await storage.uploadFile(key, testBuffer, 'image/png');
    const retrieved = await storage.getFileBuffer(key);
    expect(retrieved.toString()).toBe('test-receipt-content');

    const signedUrl = await storage.getSignedDownloadUrl(key, 300);
    expect(signedUrl).toContain('expires=300');

    await storage.deleteFile(key);
    await expect(storage.getFileBuffer(key)).rejects.toThrow();
  });
});

