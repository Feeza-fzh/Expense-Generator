import { z } from 'zod';
import { Type } from '@google/genai';

export const legibilityValues = ['clear', 'partial', 'poor'] as const;

export const categoryValues = [
  'meals',
  'travel',
  'lodging',
  'software',
  'office',
  'utilities',
  'fuel',
  'medical',
  'other',
  'unknown',
] as const;

export const anomalyTypeValues = [
  'DUPLICATE_SUSPECTED',
  'DUPLICATE_EXACT_FILE',
  'TOTAL_MISMATCH',
  'LINE_ITEMS_MISMATCH',
  'TOTAL_NOT_VERIFIED',
  'MISSING_FIELD',
  'DATE_AMBIGUOUS',
  'DATE_FUTURE',
  'LOW_LEGIBILITY',
  'MULTIPLE_RECEIPTS',
  'NON_ENGLISH',
  'UNUSUAL_CATEGORY',
  'BATCH_OVERVIEW',
  'OTHER',
] as const;

// Extractor Output Zod Schema (PRD Section 6.2)
export const extractorOutputSchema = z.object({
  receiptCountDetected: z.number().int().describe('0 = not a receipt, 1 = normal, >1 = several in one file'),
  legibility: z.enum(legibilityValues).describe('clear, partial, or poor readability'),
  merchant: z.string().nullable().describe('Printed merchant name'),
  date: z.string().nullable().describe('ISO 8601 YYYY-MM-DD or null if ambiguous/unreadable'),
  dateRaw: z.string().nullable().describe('The date text exactly as printed'),
  dateAmbiguous: z.boolean().describe('True when day-first vs month-first cannot be determined'),
  currency: z.string().nullable().describe('3-letter ISO 4217 code (e.g. USD) or null'),
  subtotal: z.string().nullable().describe('Decimal string as printed (e.g. "12.50")'),
  tax: z.string().nullable().describe('Tax decimal string, null if no tax printed'),
  tip: z.string().nullable().describe('Tip decimal string, null if no tip printed'),
  total: z.string().nullable().describe('Total decimal string'),
  pricesIncludeTax: z.boolean().nullable().describe('True/false if explicitly stated, else null'),
  paymentMethod: z.string().nullable().describe('Payment method description or null'),
  category: z.enum(categoryValues).describe('Expense category'),
  languageCode: z.string().nullable().describe('ISO 639-1 language code (e.g. "en")'),
  lineItems: z.array(
    z.object({
      description: z.string().describe('Item description'),
      quantity: z.string().nullable().describe('Quantity as printed string or null'),
      amount: z.string().nullable().describe('Amount as decimal string, may be negative for discount'),
    })
  ).describe('Line items printed on receipt'),
});

export type ExtractorOutput = z.infer<typeof extractorOutputSchema>;

// Summariser Output Zod Schema (PRD Section 6.7)
export const summariserOutputSchema = z.object({
  items: z.array(
    z.object({
      receiptId: z.string().nullable().describe('Receipt ID or null for BATCH_OVERVIEW'),
      anomalyType: z.enum(anomalyTypeValues).describe('Anomaly category'),
      note: z.string().max(300).describe('Description under 300 characters with no money amounts'),
    })
  ).max(50).describe('Audit summary items'),
});

export type SummariserOutput = z.infer<typeof summariserOutputSchema>;

export interface GeminiSchemaObject {
  type: string;
  description?: string;
  properties?: Record<string, GeminiSchemaObject>;
  items?: GeminiSchemaObject;
  enum?: string[];
  nullable?: boolean;
  required?: string[];
}

/**
 * Derives a Gemini-compatible responseSchema object from a Zod schema (A-11).
 */
export function zodToGeminiSchema(schema: z.ZodTypeAny): GeminiSchemaObject {
  let isNullable = false;
  let current: z.ZodTypeAny = schema;

  while (
    current instanceof z.ZodNullable ||
    current instanceof z.ZodOptional ||
    current instanceof z.ZodDefault
  ) {
    if (current instanceof z.ZodNullable) {
      isNullable = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodOptional) {
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      current = current._def.innerType;
    }
  }

  if (current instanceof z.ZodString) {
    return { type: Type.STRING, nullable: isNullable };
  }

  if (current instanceof z.ZodNumber) {
    const isInteger = current._def.checks.some((c) => c.kind === 'int');
    return {
      type: isInteger ? Type.INTEGER : Type.NUMBER,
      nullable: isNullable,
    };
  }

  if (current instanceof z.ZodBoolean) {
    return { type: Type.BOOLEAN, nullable: isNullable };
  }

  if (current instanceof z.ZodEnum) {
    return {
      type: Type.STRING,
      enum: current._def.values as string[],
      nullable: isNullable,
    };
  }

  if (current instanceof z.ZodArray) {
    return {
      type: Type.ARRAY,
      items: zodToGeminiSchema(current.element),
      nullable: isNullable,
    };
  }

  if (current instanceof z.ZodObject) {
    const shape = current.shape;
    const properties: Record<string, GeminiSchemaObject> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodTypeAny;
      properties[key] = zodToGeminiSchema(fieldSchema);

      // In JSON schema, if field is not optional, it is required
      if (!(fieldSchema instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: Type.OBJECT,
      properties,
      required: required.length > 0 ? required : undefined,
      nullable: isNullable,
    };
  }

  return { type: Type.STRING, nullable: isNullable };
}

export const extractorGeminiSchema = zodToGeminiSchema(extractorOutputSchema);
export const summariserGeminiSchema = zodToGeminiSchema(summariserOutputSchema);

