import { describe, it, expect } from 'vitest';
import { runReceiptChecks } from '@/domain/checks';

describe('domain/checks', () => {
  const defaultOptions = {
    amountToleranceMinor: 1,
    futureDateAllowanceDays: 1,
    nowUtc: new Date('2026-10-30T12:00:00Z'),
  };

  it('flags missing merchant, date, currency, and total', () => {
    const flags = runReceiptChecks({}, defaultOptions);
    const codes = flags.map((f) => f.code);
    expect(codes).toContain('MISSING_FIELD');
    expect(flags.filter((f) => f.code === 'MISSING_FIELD')).toHaveLength(4);
  });

  it('does NOT flag missing date if dateAmbiguous is true, but flags DATE_AMBIGUOUS', () => {
    const flags = runReceiptChecks(
      {
        merchant: 'Store',
        dateAmbiguous: true,
        dateRaw: '03/04/2026',
        currency: 'USD',
        totalMinor: 1000,
      },
      defaultOptions
    );
    const codes = flags.map((f) => f.code);
    expect(codes).toContain('DATE_AMBIGUOUS');
    expect(flags.some((f) => f.code === 'MISSING_FIELD' && f.field === 'date')).toBe(false);
  });

  it('flags invalid currency code', () => {
    const flags = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-10-25',
        currency: 'XYZ',
        totalMinor: 1000,
      },
      defaultOptions
    );
    expect(flags.some((f) => f.code === 'CURRENCY_INVALID')).toBe(true);
  });

  it('flags non-positive total', () => {
    const flags = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-10-25',
        currency: 'USD',
        totalMinor: 0,
      },
      defaultOptions
    );
    expect(flags.some((f) => f.code === 'TOTAL_NOT_POSITIVE')).toBe(true);
  });

  it('flags future date beyond allowance (FR-9, NA-8)', () => {
    const flags = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-11-05', // 6 days in future
        currency: 'USD',
        totalMinor: 1000,
      },
      defaultOptions
    );
    expect(flags.some((f) => f.code === 'DATE_FUTURE')).toBe(true);
  });

  it('flags low legibility (partial or poor)', () => {
    const flagsPartial = runReceiptChecks({ legibility: 'partial' }, defaultOptions);
    expect(flagsPartial.some((f) => f.code === 'LOW_LEGIBILITY')).toBe(true);

    const flagsPoor = runReceiptChecks({ legibility: 'poor' }, defaultOptions);
    expect(flagsPoor.some((f) => f.code === 'LOW_LEGIBILITY')).toBe(true);

    const flagsClear = runReceiptChecks({ legibility: 'clear' }, defaultOptions);
    expect(flagsClear.some((f) => f.code === 'LOW_LEGIBILITY')).toBe(false);
  });

  it('flags multiple receipts and non-English', () => {
    const flags = runReceiptChecks(
      {
        receiptCountDetected: 3,
        languageCode: 'fr',
      },
      defaultOptions
    );
    expect(flags.some((f) => f.code === 'MULTIPLE_RECEIPTS')).toBe(true);
    expect(flags.some((f) => f.code === 'NON_ENGLISH')).toBe(true);
  });

  it('verifies line items sum against subtotal (LINE_ITEMS_MISMATCH)', () => {
    const flags = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-10-25',
        currency: 'USD',
        subtotalMinor: 1000,
        totalMinor: 1000,
        lineItems: [
          { description: 'Item 1', amountMinor: 400 },
          { description: 'Item 2', amountMinor: 500 }, // sum = 900 != 1000
        ],
      },
      defaultOptions
    );
    expect(flags.some((f) => f.code === 'LINE_ITEMS_MISMATCH')).toBe(true);
  });

  it('verifies total against subtotal + tax + tip (TOTAL_MISMATCH)', () => {
    const flagsMismatch = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-10-25',
        currency: 'USD',
        subtotalMinor: 1000,
        taxMinor: 100,
        tipMinor: 200,
        totalMinor: 1500, // expected 1300
      },
      defaultOptions
    );
    expect(flagsMismatch.some((f) => f.code === 'TOTAL_MISMATCH')).toBe(true);

    const flagsMatch = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-10-25',
        currency: 'USD',
        subtotalMinor: 1000,
        taxMinor: 100,
        tipMinor: 200,
        totalMinor: 1300,
      },
      defaultOptions
    );
    expect(flagsMatch.some((f) => f.code === 'TOTAL_MISMATCH')).toBe(false);
  });

  it('flags TOTAL_NOT_VERIFIED when neither subtotal nor complete line items exist', () => {
    const flags = runReceiptChecks(
      {
        merchant: 'Store',
        date: '2026-10-25',
        currency: 'USD',
        totalMinor: 1300,
      },
      defaultOptions
    );
    expect(flags.some((f) => f.code === 'TOTAL_NOT_VERIFIED')).toBe(true);
  });
});

