export const appConfig = {
  extractor: {
    model: 'gemini-2.5-flash',
    temperature: 0,
    maxOutputTokens: 2048,
    timeoutMs: 30000,
    promptVersion: 'extractor.v1'
  },
  summariser: {
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    maxOutputTokens: 1024,
    timeoutMs: 30000,
    promptVersion: 'summariser.v1'
  },
  retry: {
    maxAttempts: 3,
    backoffBaseMs: 2000,
    backoffFactor: 2,
    jitterPct: 25
  },
  queue: {
    concurrency: 3,
    pollIntervalMs: 1000,
    leaseMs: 60000
  },
  limits: {
    batchSubmissionsPerMinute: 10,
    followUpsPerMinute: 5,
    monthlyReceiptCap: 100,
    dailySpendCapUsd: 20
  },
  upload: {
    maxFileBytes: 10485760, // 10 MB
    maxFilesPerBatch: 20,
    maxPdfPages: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  },
  retention: {
    days: 365,
    jobCron: '0 3 * * *' // 03:00 UTC daily
  },
  storage: {
    signedUrlTtlSeconds: 300 // 5 minutes
  },
  polling: {
    clientIntervalMs: 2000
  },
  checks: {
    amountToleranceMinor: 1,
    futureDateAllowanceDays: 1
  },
  pricing: {
    // Model pricing per million tokens in USD
    'gemini-2.5-flash': {
      inputPerMTok: 0.075,
      outputPerMTok: 0.3
    },
    'gemini-1.5-flash': {
      inputPerMTok: 0.075,
      outputPerMTok: 0.3
    }
  }
} as const;

export type AppConfig = typeof appConfig;

