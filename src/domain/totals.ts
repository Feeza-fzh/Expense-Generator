export interface ReceiptForTotals {
  id: string;
  currency?: string | null;
  category?: string | null;
  totalMinor?: number | null;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
}

export interface CategoryTotal {
  totalMinor: number;
  receiptCount: number;
}

export interface CurrencyTotal {
  totalMinor: number;
  receiptCount: number;
  byCategory: Record<string, CategoryTotal>;
}

export interface ReportTotals {
  byCurrency: Record<string, CurrencyTotal>;
  outsideTotals: {
    receiptCount: number;
    receiptIds: string[];
  };
  includedCount: number;
  totalCount: number;
}

/**
 * Pure function to compute report totals in integer minor units (N-4, N-5).
 * Only receipts with status === 'DONE' and non-null currency & totalMinor are summed.
 * Receipts with status === 'DONE' but null total or null currency go into outsideTotals.
 * FAILED receipts are not in includedCount and not in outsideTotals.
 */
export function computeReportTotals(receipts: ReceiptForTotals[]): ReportTotals {
  const totalCount = receipts.length;
  let includedCount = 0;

  const byCurrency: Record<string, CurrencyTotal> = {};
  const outsideReceiptIds: string[] = [];

  for (const receipt of receipts) {
    if (receipt.status !== 'DONE') {
      continue;
    }

    includedCount++;

    const currency = receipt.currency ? receipt.currency.toUpperCase() : null;
    const totalMinor = receipt.totalMinor;

    if (!currency || totalMinor === null || totalMinor === undefined) {
      outsideReceiptIds.push(receipt.id);
      continue;
    }

    const category = (receipt.category ?? 'unknown').toLowerCase();

    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        totalMinor: 0,
        receiptCount: 0,
        byCategory: {},
      };
    }

    const currEntry = byCurrency[currency];
    currEntry.totalMinor += totalMinor;
    currEntry.receiptCount += 1;

    if (!currEntry.byCategory[category]) {
      currEntry.byCategory[category] = {
        totalMinor: 0,
        receiptCount: 0,
      };
    }

    const catEntry = currEntry.byCategory[category];
    catEntry.totalMinor += totalMinor;
    catEntry.receiptCount += 1;
  }

  return {
    byCurrency,
    outsideTotals: {
      receiptCount: outsideReceiptIds.length,
      receiptIds: outsideReceiptIds,
    },
    includedCount,
    totalCount,
  };
}

