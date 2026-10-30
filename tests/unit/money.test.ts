import { describe, it, expect } from 'vitest';
import {
  parseAmountToMinor,
  formatMinorAmount,
  getCurrencyExponent,
  MAX_SAFE_MINOR_AMOUNT,
} from '@/domain/money';

describe('domain/money', () => {
  describe('getCurrencyExponent', () => {
    it('returns 2 for standard currencies and null/undefined', () => {
      expect(getCurrencyExponent('USD')).toBe(2);
      expect(getCurrencyExponent('EUR')).toBe(2);
      expect(getCurrencyExponent('GBP')).toBe(2);
      expect(getCurrencyExponent(null)).toBe(2);
      expect(getCurrencyExponent(undefined)).toBe(2);
    });

    it('returns 0 for JPY and KRW', () => {
      expect(getCurrencyExponent('JPY')).toBe(0);
      expect(getCurrencyExponent('KRW')).toBe(0);
    });

    it('returns 3 for BHD and KWD', () => {
      expect(getCurrencyExponent('BHD')).toBe(3);
      expect(getCurrencyExponent('KWD')).toBe(3);
    });
  });

  describe('parseAmountToMinor (N-2)', () => {
    it('parses standard 2-decimal amount strings', () => {
      expect(parseAmountToMinor('1234.50', 'USD')).toBe(123450);
      expect(parseAmountToMinor('0.05', 'USD')).toBe(5);
      expect(parseAmountToMinor('12.5', 'USD')).toBe(1250);
      expect(parseAmountToMinor('100', 'USD')).toBe(10000);
      expect(parseAmountToMinor('0', 'USD')).toBe(0);
    });

    it('parses negative amount strings for discounts', () => {
      expect(parseAmountToMinor('-2.00', 'USD')).toBe(-200);
      expect(parseAmountToMinor('-0.50', 'USD')).toBe(-50);
    });

    it('handles zero-decimal currencies like JPY', () => {
      expect(parseAmountToMinor('1500', 'JPY')).toBe(1500);
    });

    it('handles 3-decimal currencies like BHD', () => {
      expect(parseAmountToMinor('1.250', 'BHD')).toBe(1250);
      expect(parseAmountToMinor('1.25', 'BHD')).toBe(1250);
    });

    it('returns null for unparseable or empty values', () => {
      expect(parseAmountToMinor(null)).toBeNull();
      expect(parseAmountToMinor(undefined)).toBeNull();
      expect(parseAmountToMinor('')).toBeNull();
      expect(parseAmountToMinor('   ')).toBeNull();
      expect(parseAmountToMinor('not-a-number')).toBeNull();
      expect(parseAmountToMinor('12.34.56')).toBeNull();
      expect(parseAmountToMinor('$12.50')).toBeNull();
    });

    it('rejects numbers exceeding 32-bit signed integer max (NA-23)', () => {
      expect(parseAmountToMinor('21474836.48', 'USD')).toBeNull(); // 2147483648 > MAX_SAFE
      expect(parseAmountToMinor('21474836.47', 'USD')).toBe(MAX_SAFE_MINOR_AMOUNT);
    });
  });

  describe('formatMinorAmount (N-3)', () => {
    it('formats 2-decimal currencies with thousands separators and padding', () => {
      expect(formatMinorAmount(123450, 'USD')).toBe('1,234.50');
      expect(formatMinorAmount(5, 'USD')).toBe('0.05');
      expect(formatMinorAmount(50, 'USD')).toBe('0.50');
      expect(formatMinorAmount(0, 'USD')).toBe('0.00');
      expect(formatMinorAmount(100000000, 'USD')).toBe('1,000,000.00');
    });

    it('formats negative amounts properly', () => {
      expect(formatMinorAmount(-200, 'USD')).toBe('-2.00');
      expect(formatMinorAmount(-5, 'USD')).toBe('-0.05');
    });

    it('formats 0-decimal currencies like JPY', () => {
      expect(formatMinorAmount(1500, 'JPY')).toBe('1,500');
      expect(formatMinorAmount(0, 'JPY')).toBe('0');
    });

    it('formats 3-decimal currencies like BHD', () => {
      expect(formatMinorAmount(1250, 'BHD')).toBe('1.250');
      expect(formatMinorAmount(5, 'BHD')).toBe('0.005');
    });

    it('returns em-dash for null or undefined', () => {
      expect(formatMinorAmount(null)).toBe('—');
      expect(formatMinorAmount(undefined)).toBe('—');
    });
  });
});

