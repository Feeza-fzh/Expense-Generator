/**
 * Pure functions for money handling in accordance with rules N-1, N-2, N-3, N-4, N-5.
 * Strictly integer minor units; NO floating-point operations.
 */

const CURRENCY_EXPONENTS: Record<string, number> = {
  // 0 decimals
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // 3 decimals
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // Default is 2 for USD, EUR, GBP, CAD, AUD, etc.
};

export const MAX_SAFE_MINOR_AMOUNT = 2147483647; // 32-bit signed integer max
export const MIN_SAFE_MINOR_AMOUNT = -2147483648;

/**
 * Gets the ISO 4217 minor unit exponent for a currency code. Default is 2.
 */
export function getCurrencyExponent(currency: string | null | undefined): number {
  if (!currency) return 2;
  const upper = currency.toUpperCase();
  return CURRENCY_EXPONENTS[upper] ?? 2;
}

/**
 * N-2: Parses model decimal string into integer minor units without floating-point math.
 * Handles strings like "1234.50", "12", "-2.00", "0.05".
 */
export function parseAmountToMinor(
  amountStr: string | null | undefined,
  currency?: string | null
): number | null {
  if (amountStr === null || amountStr === undefined) {
    return null;
  }

  const trimmed = amountStr.trim();
  if (trimmed === '') {
    return null;
  }

  // Check valid decimal string format (optional leading minus, digits, optional decimal point and digits)
  const isNegative = trimmed.startsWith('-');
  const unsignedStr = isNegative ? trimmed.slice(1) : trimmed;

  if (!/^\d+(\.\d+)?$/.test(unsignedStr)) {
    return null;
  }

  const exponent = getCurrencyExponent(currency);
  const parts = unsignedStr.split('.');
  const wholePart = parts[0] ?? '0';
  const fracPart = parts[1] ?? '';

  if (exponent === 0) {
    // If exponent is 0, fraction should be discarded or rounded, but for receipts we take whole digits
    const minorStr = wholePart;
    const value = parseInt(minorStr, 10);
    if (!Number.isSafeInteger(value)) return null;
    const finalVal = isNegative ? -value : value;
    if (finalVal > MAX_SAFE_MINOR_AMOUNT || finalVal < MIN_SAFE_MINOR_AMOUNT) return null;
    return finalVal;
  }

  // Pad or trim fraction to exact exponent length
  let paddedFrac = fracPart.slice(0, exponent);
  while (paddedFrac.length < exponent) {
    paddedFrac += '0';
  }

  // Join whole and padded fraction
  const minorStr = wholePart + paddedFrac;
  const value = parseInt(minorStr, 10);
  if (!Number.isSafeInteger(value)) return null;

  const finalVal = isNegative ? -value : value;
  if (finalVal > MAX_SAFE_MINOR_AMOUNT || finalVal < MIN_SAFE_MINOR_AMOUNT) {
    return null;
  }

  return finalVal;
}

/**
 * N-3: Formats minor units for display from string operations only. Never divides.
 * Examples: (123450, "USD") => "1,234.50", (5, "USD") => "0.05", (-200, "USD") => "-2.00"
 */
export function formatMinorAmount(
  minorUnits: number | null | undefined,
  currency?: string | null
): string {
  if (minorUnits === null || minorUnits === undefined) {
    return '—';
  }

  const isNegative = minorUnits < 0;
  const absUnits = Math.abs(minorUnits);
  const exponent = getCurrencyExponent(currency);
  const absStr = absUnits.toString();

  let formatted = '';
  if (exponent === 0) {
    formatted = addThousandsSeparators(absStr);
  } else {
    let padded = absStr;
    if (padded.length <= exponent) {
      padded = padded.padStart(exponent + 1, '0');
    }
    const whole = padded.slice(0, padded.length - exponent);
    const frac = padded.slice(padded.length - exponent);
    formatted = `${addThousandsSeparators(whole)}.${frac}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

function addThousandsSeparators(numStr: string): string {
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

