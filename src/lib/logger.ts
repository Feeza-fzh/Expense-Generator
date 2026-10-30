export interface StructuredLogPayload {
  jobId?: string;
  batchId?: string;
  receiptId?: string;
  userId?: string;
  type?: string;
  status?: string;
  attempts?: number;
  errorCode?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  message?: string;
  [key: string]: unknown;
}

export const logger = {
  info(msg: string, payload?: StructuredLogPayload): void {
    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message: msg,
        ...payload,
      })
    );
  },
  warn(msg: string, payload?: StructuredLogPayload): void {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: msg,
        ...payload,
      })
    );
  },
  error(msg: string, payload?: StructuredLogPayload): void {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: msg,
        ...payload,
      })
    );
  },
};

