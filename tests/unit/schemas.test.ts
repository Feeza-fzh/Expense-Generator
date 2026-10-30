import { describe, it, expect } from 'vitest';
import {
  extractorOutputSchema,
  extractorGeminiSchema,
  summariserOutputSchema,
  summariserGeminiSchema,
  zodToGeminiSchema,
} from '@/ai/schemas';
import { Type } from '@google/genai';
import { z } from 'zod';

describe('ai/schemas (A-11)', () => {
  it('converts basic primitives correctly', () => {
    const stringSchema = zodToGeminiSchema(z.string());
    expect(stringSchema.type).toBe(Type.STRING);
    expect(stringSchema.nullable).toBe(false);

    const nullableStringSchema = zodToGeminiSchema(z.string().nullable());
    expect(nullableStringSchema.type).toBe(Type.STRING);
    expect(nullableStringSchema.nullable).toBe(true);

    const intSchema = zodToGeminiSchema(z.number().int());
    expect(intSchema.type).toBe(Type.INTEGER);

    const enumSchema = zodToGeminiSchema(z.enum(['a', 'b', 'c']));
    expect(enumSchema.type).toBe(Type.STRING);
    expect(enumSchema.enum).toEqual(['a', 'b', 'c']);
  });

  it('proves extractorGeminiSchema conforms to Gemini Schema structure', () => {
    expect(extractorGeminiSchema.type).toBe(Type.OBJECT);
    expect(extractorGeminiSchema.properties).toBeDefined();

    const props = extractorGeminiSchema.properties!;
    expect(props.receiptCountDetected?.type).toBe(Type.INTEGER);
    expect(props.legibility?.type).toBe(Type.STRING);
    expect(props.legibility?.enum).toEqual(['clear', 'partial', 'poor']);
    expect(props.merchant?.type).toBe(Type.STRING);
    expect(props.merchant?.nullable).toBe(true);
    expect(props.lineItems?.type).toBe(Type.ARRAY);
    expect(props.lineItems?.items?.type).toBe(Type.OBJECT);

    // Verify required properties include non-optional fields
    expect(extractorGeminiSchema.required).toContain('receiptCountDetected');
    expect(extractorGeminiSchema.required).toContain('category');
    expect(extractorGeminiSchema.required).toContain('lineItems');
  });

  it('proves summariserGeminiSchema conforms to Gemini Schema structure', () => {
    expect(summariserGeminiSchema.type).toBe(Type.OBJECT);
    expect(summariserGeminiSchema.properties).toBeDefined();

    const props = summariserGeminiSchema.properties!;
    expect(props.items?.type).toBe(Type.ARRAY);
    expect(props.items?.items?.type).toBe(Type.OBJECT);

    const itemProps = props.items?.items?.properties!;
    expect(itemProps.receiptId?.type).toBe(Type.STRING);
    expect(itemProps.receiptId?.nullable).toBe(true);
    expect(itemProps.anomalyType?.type).toBe(Type.STRING);
    expect(itemProps.note?.type).toBe(Type.STRING);
  });

  it('validates ExtractorOutput with Zod schema', () => {
    const validData = {
      receiptCountDetected: 1,
      legibility: 'clear',
      merchant: 'Target Store',
      date: '2026-10-25',
      dateRaw: '10/25/2026',
      dateAmbiguous: false,
      currency: 'USD',
      subtotal: '24.99',
      tax: '2.00',
      tip: null,
      total: '26.99',
      pricesIncludeTax: false,
      paymentMethod: 'MASTERCARD',
      category: 'office',
      languageCode: 'en',
      lineItems: [
        { description: 'Notebooks', quantity: '2', amount: '24.99' },
      ],
    };

    const parseRes = extractorOutputSchema.safeParse(validData);
    expect(parseRes.success).toBe(true);
  });
});

