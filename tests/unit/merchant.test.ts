import { describe, it, expect } from 'vitest';
import { normalizeMerchant } from '@/domain/merchant';

describe('domain/merchant', () => {
  it('handles standard merchant normalization', () => {
    expect(normalizeMerchant('STARBUCKS #123')).toBe('starbucks');
    expect(normalizeMerchant('Starbucks')).toBe('starbucks');
    expect(normalizeMerchant('  Target Store #0452  ')).toBe('target store');
  });

  it('strips punctuation and store number tokens', () => {
    expect(normalizeMerchant('McDonald\'s #99')).toBe('mcdonalds');
    expect(normalizeMerchant('WAL-MART 1234')).toBe('walmart');
    expect(normalizeMerchant('Uber *Trip, Inc.')).toBe('uber trip inc');
  });

  it('returns null for empty or non-string inputs', () => {
    expect(normalizeMerchant(null)).toBeNull();
    expect(normalizeMerchant('')).toBeNull();
    expect(normalizeMerchant('   ')).toBeNull();
    expect(normalizeMerchant('#1234 5678')).toBeNull();
  });
});
