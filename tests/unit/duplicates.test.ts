import { describe, it, expect } from 'vitest';
import { findDuplicateFlags } from '@/domain/duplicates';

describe('domain/duplicates', () => {
  it('flags exact file duplicate (DUPLICATE_EXACT_FILE) on the later receipt', () => {
    const existing = {
      id: 'rcpt_1',
      fileSha256: 'hash123',
      createdAt: '2026-10-30T10:00:00Z',
    };
    const current = {
      id: 'rcpt_2',
      fileSha256: 'hash123',
      createdAt: '2026-10-30T10:05:00Z',
    };

    const flags = findDuplicateFlags(current, [existing, current]);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.code).toBe('DUPLICATE_EXACT_FILE');
    expect(flags[0]?.otherReceiptId).toBe('rcpt_1');
  });

  it('flags suspected duplicate (DUPLICATE_SUSPECTED) on matching merchant, date, total', () => {
    const existing = {
      id: 'rcpt_1',
      merchantNormalized: 'starbucks',
      purchaseDate: '2026-10-25',
      totalMinor: 450,
      createdAt: '2026-10-30T10:00:00Z',
    };
    const current = {
      id: 'rcpt_2',
      merchantNormalized: 'starbucks',
      purchaseDate: '2026-10-25',
      totalMinor: 450,
      createdAt: '2026-10-30T10:05:00Z',
    };

    const flags = findDuplicateFlags(current, [existing, current]);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.code).toBe('DUPLICATE_SUSPECTED');
    expect(flags[0]?.otherReceiptId).toBe('rcpt_1');
  });

  it('does NOT flag earlier receipts or receipts with differing totals or dates', () => {
    const earlier = {
      id: 'rcpt_1',
      merchantNormalized: 'starbucks',
      purchaseDate: '2026-10-25',
      totalMinor: 450,
      createdAt: '2026-10-30T10:00:00Z',
    };
    const later = {
      id: 'rcpt_2',
      merchantNormalized: 'starbucks',
      purchaseDate: '2026-10-26', // different date
      totalMinor: 450,
      createdAt: '2026-10-30T10:05:00Z',
    };

    const flagsForEarlier = findDuplicateFlags(earlier, [earlier, later]);
    expect(flagsForEarlier).toHaveLength(0);

    const flagsForLater = findDuplicateFlags(later, [earlier, later]);
    expect(flagsForLater).toHaveLength(0);
  });
});

