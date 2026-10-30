import { describe, it, expect } from 'vitest';
import { computeReportTotals, ReceiptForTotals } from '@/domain/totals';

describe('domain/totals', () => {
  it('computes totals per currency and category in minor units (N-4, N-5, FR-14)', () => {
    const receipts: ReceiptForTotals[] = [
      { id: '1', status: 'DONE', currency: 'USD', category: 'MEALS', totalMinor: 2500 },
      { id: '2', status: 'DONE', currency: 'USD', category: 'MEALS', totalMinor: 1500 },
      { id: '3', status: 'DONE', currency: 'USD', category: 'TRAVEL', totalMinor: 5000 },
      { id: '4', status: 'DONE', currency: 'EUR', category: 'LODGING', totalMinor: 9800 },
    ];

    const result = computeReportTotals(receipts);

    expect(result.includedCount).toBe(4);
    expect(result.totalCount).toBe(4);
    expect(result.outsideTotals.receiptCount).toBe(0);

    // USD
    expect(result.byCurrency.USD?.totalMinor).toBe(9000);
    expect(result.byCurrency.USD?.receiptCount).toBe(3);
    expect(result.byCurrency.USD?.byCategory.meals?.totalMinor).toBe(4000);
    expect(result.byCurrency.USD?.byCategory.meals?.receiptCount).toBe(2);
    expect(result.byCurrency.USD?.byCategory.travel?.totalMinor).toBe(5000);

    // EUR
    expect(result.byCurrency.EUR?.totalMinor).toBe(9800);
    expect(result.byCurrency.EUR?.receiptCount).toBe(1);
    expect(result.byCurrency.EUR?.byCategory.lodging?.totalMinor).toBe(9800);
  });

  it('puts done receipts with null currency or null total into outsideTotals', () => {
    const receipts: ReceiptForTotals[] = [
      { id: '1', status: 'DONE', currency: 'USD', category: 'MEALS', totalMinor: 2500 },
      { id: '2', status: 'DONE', currency: null, category: 'MEALS', totalMinor: 1500 },
      { id: '3', status: 'DONE', currency: 'USD', category: 'TRAVEL', totalMinor: null },
      { id: '4', status: 'FAILED', currency: 'USD', category: 'MEALS', totalMinor: 3000 },
    ];

    const result = computeReportTotals(receipts);

    expect(result.totalCount).toBe(4);
    expect(result.includedCount).toBe(3); // receipts 1, 2, 3 are DONE
    expect(result.outsideTotals.receiptCount).toBe(2);
    expect(result.outsideTotals.receiptIds).toEqual(['2', '3']);
    expect(result.byCurrency.USD?.totalMinor).toBe(2500);
    expect(result.byCurrency.USD?.receiptCount).toBe(1);
  });
});

