export interface Flag {
  code: string;
  detail?: string;
  field?: string;
  differenceMinor?: number;
  expectedTotalMinor?: number;
  actualTotalMinor?: number;
  legibility?: string;
  receiptCount?: number;
  languageCode?: string;
  otherReceiptId?: string;
  date?: string;
  [key: string]: unknown;
}

export interface ExtractedReceiptData {
  merchant?: string | null;
  date?: string | null; // ISO YYYY-MM-DD
  dateRaw?: string | null;
  dateAmbiguous?: boolean;
  currency?: string | null;
  subtotalMinor?: number | null;
  taxMinor?: number | null;
  tipMinor?: number | null;
  totalMinor?: number | null;
  pricesIncludeTax?: boolean | null;
  legibility?: 'clear' | 'partial' | 'poor' | null;
  receiptCountDetected?: number | null;
  languageCode?: string | null;
  lineItems?: Array<{
    description?: string;
    quantity?: string | number | null;
    amountMinor?: number | null;
  }>;
}

export interface CheckOptions {
  amountToleranceMinor: number;
  futureDateAllowanceDays: number;
  nowUtc?: Date;
}

const ISO_4217_CODES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
  'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
  'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
  'SEK', 'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'STN', 'SVC', 'SYP', 'SZL',
  'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH',
  'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
  'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL'
]);

export function runReceiptChecks(
  data: ExtractedReceiptData,
  options: CheckOptions
): Flag[] {
  const flags: Flag[] = [];

  // 1. DATE_AMBIGUOUS check
  if (data.dateAmbiguous) {
    flags.push({
      code: 'DATE_AMBIGUOUS',
      detail: data.dateRaw ? `Ambiguous date printed: ${data.dateRaw}` : 'Date is ambiguous',
    });
  }

  // 2. MISSING_FIELD: merchant, date, currency, or total is null.
  // Note: Date is NOT flagged here when DATE_AMBIGUOUS applies (PRD Section 6.5)
  if (!data.merchant || data.merchant.trim() === '') {
    flags.push({ code: 'MISSING_FIELD', field: 'merchant', detail: 'Merchant is missing' });
  }

  if (data.date === null || data.date === undefined) {
    if (!data.dateAmbiguous) {
      flags.push({ code: 'MISSING_FIELD', field: 'date', detail: 'Date is missing' });
    }
  }

  if (!data.currency) {
    flags.push({ code: 'MISSING_FIELD', field: 'currency', detail: 'Currency is missing' });
  } else if (!ISO_4217_CODES.has(data.currency.toUpperCase())) {
    flags.push({
      code: 'CURRENCY_INVALID',
      currency: data.currency,
      detail: `Currency ${data.currency} is not a valid ISO 4217 code`,
    });
  }

  if (data.totalMinor === null || data.totalMinor === undefined) {
    flags.push({ code: 'MISSING_FIELD', field: 'total', detail: 'Total amount is missing' });
  } else if (data.totalMinor <= 0) {
    flags.push({
      code: 'TOTAL_NOT_POSITIVE',
      totalMinor: data.totalMinor,
      detail: 'Total amount must be greater than zero',
    });
  }

  // 3. DATE_FUTURE check
  if (data.date) {
    const receiptDate = new Date(`${data.date}T00:00:00.000Z`);
    if (!isNaN(receiptDate.getTime())) {
      const now = options.nowUtc ?? new Date();
      const cutoff = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + options.futureDateAllowanceDays,
          23, 59, 59, 999
        )
      );
      if (receiptDate.getTime() > cutoff.getTime()) {
        flags.push({
          code: 'DATE_FUTURE',
          date: data.date,
          detail: `Receipt date ${data.date} is in the future`,
        });
      }
    }
  }

  // 4. LOW_LEGIBILITY
  if (data.legibility === 'partial' || data.legibility === 'poor') {
    flags.push({
      code: 'LOW_LEGIBILITY',
      legibility: data.legibility,
      detail: `Document legibility is ${data.legibility}`,
    });
  }

  // 5. MULTIPLE_RECEIPTS
  if (data.receiptCountDetected && data.receiptCountDetected > 1) {
    flags.push({
      code: 'MULTIPLE_RECEIPTS',
      receiptCount: data.receiptCountDetected,
      detail: `${data.receiptCountDetected} receipts detected in file`,
    });
  }

  // 6. NON_ENGLISH
  if (data.languageCode && data.languageCode.toLowerCase() !== 'en') {
    flags.push({
      code: 'NON_ENGLISH',
      languageCode: data.languageCode,
      detail: `Receipt language is ${data.languageCode}`,
    });
  }

  // 7. Arithmetic checks: LINE_ITEMS_MISMATCH, TOTAL_MISMATCH, TOTAL_NOT_VERIFIED
  let lineItemsSum: number | null = null;
  let allLinesHaveAmount = false;

  if (data.lineItems && data.lineItems.length > 0) {
    allLinesHaveAmount = data.lineItems.every(
      (item) => item.amountMinor !== null && item.amountMinor !== undefined
    );
    if (allLinesHaveAmount) {
      lineItemsSum = data.lineItems.reduce((acc, item) => acc + (item.amountMinor ?? 0), 0);
    }
  }

  // Check LINE_ITEMS_MISMATCH: All line items have amounts and a subtotal exists
  if (
    allLinesHaveAmount &&
    lineItemsSum !== null &&
    data.subtotalMinor !== null &&
    data.subtotalMinor !== undefined
  ) {
    const diff = Math.abs(lineItemsSum - data.subtotalMinor);
    if (diff > options.amountToleranceMinor) {
      flags.push({
        code: 'LINE_ITEMS_MISMATCH',
        differenceMinor: diff,
        detail: `Line items sum (${lineItemsSum}) differs from subtotal (${data.subtotalMinor}) by ${diff} minor units`,
      });
    }
  }

  // Determine baseline for TOTAL check
  let baseline: number | null = null;
  if (data.subtotalMinor !== null && data.subtotalMinor !== undefined) {
    baseline = data.subtotalMinor;
  } else if (allLinesHaveAmount && lineItemsSum !== null) {
    baseline = lineItemsSum;
  }

  if (data.totalMinor !== null && data.totalMinor !== undefined) {
    if (baseline === null) {
      flags.push({
        code: 'TOTAL_NOT_VERIFIED',
        detail: 'No subtotal or complete line items available to verify total',
      });
    } else {
      // Expected total = baseline + tax (0 if null) + tip (0 if null)
      // When pricesIncludeTax is true and there is no subtotal, tax is not added.
      let taxToAdd = data.taxMinor ?? 0;
      if (data.pricesIncludeTax === true && (data.subtotalMinor === null || data.subtotalMinor === undefined)) {
        taxToAdd = 0;
      }
      const tipToAdd = data.tipMinor ?? 0;
      const expectedTotal = baseline + taxToAdd + tipToAdd;

      const diff = Math.abs(data.totalMinor - expectedTotal);
      if (diff > options.amountToleranceMinor) {
        flags.push({
          code: 'TOTAL_MISMATCH',
          differenceMinor: diff,
          expectedTotalMinor: expectedTotal,
          actualTotalMinor: data.totalMinor,
          detail: `Total (${data.totalMinor}) differs from expected (${expectedTotal}) by ${diff} minor units`,
        });
      }
    }
  }

  return flags;
}
