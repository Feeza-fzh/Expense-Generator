export interface SummaryItem {
  receiptId: string | null;
  anomalyType: string;
  note: string;
}

export interface SummariserOutput {
  items: SummaryItem[];
}

const CURRENCY_SYMBOLS = /[\$\€\£\¥\₹\₽\₩\₪\₫\฿\₱\₺\₸\₴\₭\₮\₦]/;
const CURRENCY_CODE_NEAR_NUMBER = /\b(?:USD|EUR|GBP|CAD|AUD|JPY|CHF|CNY|INR)\s*\d+|\d+\s*(?:USD|EUR|GBP|CAD|AUD|JPY|CHF|CNY|INR)\b/i;
const DECIMAL_NUMBER = /\b\d+\.\d+\b/;

export interface SummaryValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates Summariser output per PRD Section 6.7 and Rule N-7:
 * - Exactly one item has anomalyType BATCH_OVERVIEW and receiptId null.
 * - Every other receiptId belongs to the batch.
 * - No note contains a currency symbol, a currency code next to a number, or a decimal number.
 * - Note at most 300 characters.
 * - At most 50 items.
 */
export function validateSummariserOutput(
  output: SummariserOutput,
  validReceiptIds: Set<string>
): SummaryValidationResult {
  if (!output.items || !Array.isArray(output.items)) {
    return { valid: false, error: 'Summariser output must have an items array.' };
  }

  if (output.items.length === 0) {
    return { valid: false, error: 'Summariser output must contain at least one item (BATCH_OVERVIEW).' };
  }

  if (output.items.length > 50) {
    return { valid: false, error: 'Summariser output exceeded maximum of 50 items.' };
  }

  const overviewItems = output.items.filter(
    (item) => item.anomalyType === 'BATCH_OVERVIEW' && item.receiptId === null
  );

  if (overviewItems.length !== 1) {
    return {
      valid: false,
      error: `Expected exactly one BATCH_OVERVIEW item with receiptId null, found ${overviewItems.length}.`,
    };
  }

  for (let i = 0; i < output.items.length; i++) {
    const item = output.items[i];
    if (!item) continue;

    // Check receiptId
    if (item.anomalyType === 'BATCH_OVERVIEW') {
      if (item.receiptId !== null) {
        return {
          valid: false,
          error: `BATCH_OVERVIEW item must have receiptId null, got "${item.receiptId}".`,
        };
      }
    } else {
      if (!item.receiptId || !validReceiptIds.has(item.receiptId)) {
        return {
          valid: false,
          error: `Item ${i} references receiptId "${item.receiptId}" which is not in this batch.`,
        };
      }
    }

    // Check note length
    if (typeof item.note !== 'string') {
      return { valid: false, error: `Item ${i} note must be a string.` };
    }

    if (item.note.length > 300) {
      return { valid: false, error: `Item ${i} note exceeds 300 characters (${item.note.length} chars).` };
    }

    // Check N-7: No money amounts, no currency symbols, no currency code next to number, no decimals
    if (CURRENCY_SYMBOLS.test(item.note)) {
      return {
        valid: false,
        error: `Rule N-7 violation: Item ${i} note contains a currency symbol: "${item.note}".`,
      };
    }

    if (CURRENCY_CODE_NEAR_NUMBER.test(item.note)) {
      return {
        valid: false,
        error: `Rule N-7 violation: Item ${i} note contains a currency code next to a number: "${item.note}".`,
      };
    }

    if (DECIMAL_NUMBER.test(item.note)) {
      return {
        valid: false,
        error: `Rule N-7 violation: Item ${i} note contains a decimal number: "${item.note}".`,
      };
    }
  }

  return { valid: true };
}

