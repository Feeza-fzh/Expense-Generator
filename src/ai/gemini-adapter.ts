import { GoogleGenAI } from '@google/genai';
import { appConfig } from '../../config/app.config';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import {
  extractorOutputSchema,
  extractorGeminiSchema,
  summariserOutputSchema,
  summariserGeminiSchema,
  ExtractorOutput,
  SummariserOutput,
} from './schemas';
import { loadPrompt } from './prompt-loader';

export interface ModelCallResult<T> {
  data: T;
  rawJson: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  modelId: string;
  promptVersion: string;
}

export interface AiAdapter {
  extractReceipt(
    fileBuffer: Buffer,
    mimeType: string,
    retryContext?: string
  ): Promise<ModelCallResult<ExtractorOutput>>;

  summariseBatch(
    reportJsonText: string,
    retryContext?: string
  ): Promise<ModelCallResult<SummariserOutput>>;
}

export function calculateCostMicros(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = (appConfig.pricing as Record<string, { inputPerMTok: number; outputPerMTok: number }>)[modelId] ?? {
    inputPerMTok: 0.075,
    outputPerMTok: 0.3,
  };

  // Cost in USD = (inputTokens / 1,000,000) * inputPerMTok + (outputTokens / 1,000,000) * outputPerMTok
  // Cost in micros (1 USD = 1,000,000 micros)
  const inputCostMicros = inputTokens * pricing.inputPerMTok;
  const outputCostMicros = outputTokens * pricing.outputPerMTok;
  return Math.round(inputCostMicros + outputCostMicros);
}

class GeminiAiAdapter implements AiAdapter {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new AppError('INTERNAL_ERROR', 500);
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async extractReceipt(
    fileBuffer: Buffer,
    mimeType: string,
    retryContext?: string
  ): Promise<ModelCallResult<ExtractorOutput>> {
    const modelId = appConfig.extractor.model;
    const promptVersion = appConfig.extractor.promptVersion;
    const systemPrompt = loadPrompt(promptVersion);

    const client = this.getClient();
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      appConfig.extractor.timeoutMs
    );

    try {
      const promptText = retryContext
        ? `Please extract receipt fields. Previous attempt had validation errors: ${retryContext}`
        : 'Please extract all printed receipt fields according to the schema.';

      const base64Data = fileBuffer.toString('base64');
      const response = await client.models.generateContent({
        model: modelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: appConfig.extractor.temperature,
          maxOutputTokens: appConfig.extractor.maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: extractorGeminiSchema as any,
          abortSignal: abortController.signal,
        },
      });

      clearTimeout(timeoutId);

      const rawJson = response.text ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        throw new AppError('INVALID_MODEL_OUTPUT', 500);
      }

      const validated = extractorOutputSchema.safeParse(parsed);
      if (!validated.success) {
        throw new AppError('INVALID_MODEL_OUTPUT', 500);
      }

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 2000;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 500;
      const estimatedCostMicros = calculateCostMicros(modelId, inputTokens, outputTokens);

      return {
        data: validated.data,
        rawJson,
        inputTokens,
        outputTokens,
        estimatedCostMicros,
        modelId,
        promptVersion,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) {
        throw err;
      }

      const errorStr = String(err);
      if (abortController.signal.aborted || errorStr.includes('abort') || errorStr.includes('timeout')) {
        throw new AppError('PROVIDER_TIMEOUT', 504);
      }

      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        throw new AppError('PROVIDER_UNAVAILABLE', 503);
      }

      if (errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('UNAVAILABLE')) {
        throw new AppError('PROVIDER_UNAVAILABLE', 503);
      }

      if (errorStr.includes('unreadable') || errorStr.includes('blocked') || errorStr.includes('SAFETY')) {
        throw new AppError('UNREADABLE_FILE', 422);
      }

      logger.error('Unexpected error during Gemini extraction', {
        message: err instanceof Error ? err.message : errorStr,
      });
      throw new AppError('INTERNAL_ERROR', 500);
    }
  }

  async summariseBatch(
    reportJsonText: string,
    retryContext?: string
  ): Promise<ModelCallResult<SummariserOutput>> {
    const modelId = appConfig.summariser.model;
    const promptVersion = appConfig.summariser.promptVersion;
    const systemPrompt = loadPrompt(promptVersion);

    const client = this.getClient();
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      appConfig.summariser.timeoutMs
    );

    try {
      const userContent = retryContext
        ? `${reportJsonText}\n\nNote: previous summary attempt was rejected: ${retryContext}`
        : reportJsonText;

      const response = await client.models.generateContent({
        model: modelId,
        contents: [
          {
            role: 'user',
            parts: [{ text: userContent }],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: appConfig.summariser.temperature,
          maxOutputTokens: appConfig.summariser.maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: summariserGeminiSchema as any,
          abortSignal: abortController.signal,
        },
      });

      clearTimeout(timeoutId);

      const rawJson = response.text ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        throw new AppError('INVALID_MODEL_OUTPUT', 500);
      }

      const validated = summariserOutputSchema.safeParse(parsed);
      if (!validated.success) {
        throw new AppError('INVALID_MODEL_OUTPUT', 500);
      }

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 3000;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 300;
      const estimatedCostMicros = calculateCostMicros(modelId, inputTokens, outputTokens);

      return {
        data: validated.data,
        rawJson,
        inputTokens,
        outputTokens,
        estimatedCostMicros,
        modelId,
        promptVersion,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) {
        throw err;
      }

      const errorStr = String(err);
      if (abortController.signal.aborted || errorStr.includes('abort') || errorStr.includes('timeout')) {
        throw new AppError('PROVIDER_TIMEOUT', 504);
      }

      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        throw new AppError('PROVIDER_UNAVAILABLE', 503);
      }

      if (errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('UNAVAILABLE')) {
        throw new AppError('PROVIDER_UNAVAILABLE', 503);
      }

      logger.error('Unexpected error during Gemini summary', {
        message: err instanceof Error ? err.message : errorStr,
      });
      throw new AppError('INTERNAL_ERROR', 500);
    }
  }
}

// Mock AI adapter for tests (N-34)
export class MockAiAdapter implements AiAdapter {
  public mockExtractResult?: ModelCallResult<ExtractorOutput>;
  public mockSummariseResult?: ModelCallResult<SummariserOutput>;
  public extractHandler?: (fileBuffer: Buffer, mimeType: string) => Promise<ModelCallResult<ExtractorOutput>>;
  public summariseHandler?: (reportJsonText: string) => Promise<ModelCallResult<SummariserOutput>>;

  async extractReceipt(
    fileBuffer: Buffer,
    mimeType: string,
    _retryContext?: string
  ): Promise<ModelCallResult<ExtractorOutput>> {
    if (this.extractHandler) {
      return this.extractHandler(fileBuffer, mimeType);
    }
    if (this.mockExtractResult) {
      return this.mockExtractResult;
    }
    return {
      data: {
        receiptCountDetected: 1,
        legibility: 'clear',
        merchant: 'Sample Merchant',
        date: '2026-10-25',
        dateRaw: '2026-10-25',
        dateAmbiguous: false,
        currency: 'USD',
        subtotal: '25.00',
        tax: '2.50',
        tip: '0.00',
        total: '27.50',
        pricesIncludeTax: false,
        paymentMethod: 'VISA',
        category: 'meals',
        languageCode: 'en',
        lineItems: [
          { description: 'Lunch special', quantity: '1', amount: '25.00' },
        ],
      },
      rawJson: '{}',
      inputTokens: 1200,
      outputTokens: 250,
      estimatedCostMicros: 165,
      modelId: 'gemini-2.5-flash',
      promptVersion: 'extractor.v1',
    };
  }

  async summariseBatch(
    reportJsonText: string,
    _retryContext?: string
  ): Promise<ModelCallResult<SummariserOutput>> {
    if (this.summariseHandler) {
      return this.summariseHandler(reportJsonText);
    }
    if (this.mockSummariseResult) {
      return this.mockSummariseResult;
    }
    return {
      data: {
        items: [
          {
            receiptId: null,
            anomalyType: 'BATCH_OVERVIEW',
            note: 'All receipts processed cleanly with no anomalies detected.',
          },
        ],
      },
      rawJson: '{}',
      inputTokens: 1500,
      outputTokens: 100,
      estimatedCostMicros: 140,
      modelId: 'gemini-2.5-flash',
      promptVersion: 'summariser.v1',
    };
  }
}

let activeAiAdapter: AiAdapter =
  process.env.NODE_ENV === 'test' ? new MockAiAdapter() : new GeminiAiAdapter();

export function getAiAdapter(): AiAdapter {
  return activeAiAdapter;
}

export function setAiAdapterForTest(adapter: AiAdapter): void {
  activeAiAdapter = adapter;
}

