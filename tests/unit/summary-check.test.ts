import { describe, it, expect } from 'vitest';
import { validateSummariserOutput } from '@/domain/summary-check';

describe('domain/summary-check', () => {
  const validReceiptIds = new Set(['rcpt_1', 'rcpt_2']);

  it('accepts valid summary output', () => {
    const output = {
      items: [
        {
          receiptId: null,
          anomalyType: 'BATCH_OVERVIEW',
          note: 'Batch overview: 2 receipts processed with 1 duplicate flagged.',
        },
        {
          receiptId: 'rcpt_2',
          anomalyType: 'DUPLICATE_SUSPECTED',
          note: 'Suspected duplicate with receipt rcpt_1.',
        },
      ],
    };

    const res = validateSummariserOutput(output, validReceiptIds);
    expect(res.valid).toBe(true);
  });

  it('rejects summary output with currency symbols (Rule N-7)', () => {
    const output = {
      items: [
        {
          receiptId: null,
          anomalyType: 'BATCH_OVERVIEW',
          note: 'Total spent is $45 across 2 receipts.',
        },
      ],
    };

    const res = validateSummariserOutput(output, validReceiptIds);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Rule N-7 violation');
  });

  it('rejects summary output with currency codes next to numbers (Rule N-7)', () => {
    const output = {
      items: [
        {
          receiptId: null,
          anomalyType: 'BATCH_OVERVIEW',
          note: 'Batch overview: Found 50 USD discrepancy.',
        },
      ],
    };

    const res = validateSummariserOutput(output, validReceiptIds);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Rule N-7 violation');
  });

  it('rejects summary output with decimal numbers (Rule N-7)', () => {
    const output = {
      items: [
        {
          receiptId: null,
          anomalyType: 'BATCH_OVERVIEW',
          note: 'Discrepancy of 12.50 detected.',
        },
      ],
    };

    const res = validateSummariserOutput(output, validReceiptIds);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Rule N-7 violation');
  });

  it('rejects summary missing BATCH_OVERVIEW or having multiple', () => {
    const output = {
      items: [
        {
          receiptId: 'rcpt_1',
          anomalyType: 'DATE_AMBIGUOUS',
          note: 'Date was ambiguous.',
        },
      ],
    };

    const res = validateSummariserOutput(output, validReceiptIds);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('BATCH_OVERVIEW');
  });
});

