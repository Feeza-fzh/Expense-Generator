/**
 * Section 6.5: Merchant normalization
 * Lowercase the name. Remove punctuation. Remove store-number tokens
 * (a token that starts with # or is only digits). Collapse spaces.
 * Example: "STARBUCKS #123" and "Starbucks" both become "starbucks".
 */
export function normalizeMerchant(rawMerchant: string | null | undefined): string | null {
  if (!rawMerchant) return null;

  const trimmed = rawMerchant.trim();
  if (!trimmed) return null;

  // 1. Lowercase
  const lower = trimmed.toLowerCase();

  // 2. Split into tokens by whitespace
  const tokens = lower.split(/\s+/);

  // 3. Filter tokens: remove store-number tokens (starts with # or consists entirely of digits)
  // Also strip surrounding punctuation from tokens
  const cleanTokens: string[] = [];

  for (const token of tokens) {
    // If token starts with # (e.g. #123, #456b) or is pure digits
    if (token.startsWith('#') || /^\d+$/.test(token)) {
      continue;
    }

    // Strip punctuation from token edges and internal punctuation (like commas, periods, apostrophes)
    const cleaned = token.replace(/[^a-z0-9]/g, '');
    if (cleaned.length > 0) {
      // Check if after stripping punctuation it's pure digits
      if (!/^\d+$/.test(cleaned)) {
        cleanTokens.push(cleaned);
      }
    }
  }

  if (cleanTokens.length === 0) {
    return null;
  }

  // 4. Join collapsed spaces
  return cleanTokens.join(' ');
}

