export const RECEIPT_ERROR_MESSAGES = {
  UNSUPPORTED_TYPE: 'This file type is not supported. Upload a JPEG, PNG, WebP or PDF.',
  FILE_TOO_LARGE: 'This file is too large. Files can be up to 10 MB and PDFs up to 5 pages.',
  EMPTY_FILE: 'This file is empty.',
  UNREADABLE_FILE: 'We could not open this file. It may be damaged. Try a new photo or scan.',
  NOT_A_RECEIPT: 'This does not look like a receipt.',
  PROVIDER_TIMEOUT: 'The reading service took too long. Upload this file again later.',
  PROVIDER_UNAVAILABLE: 'The reading service is not available right now. Upload this file again later.',
  INVALID_MODEL_OUTPUT: 'We could not read this receipt reliably, so we did not guess. Try a clearer photo.',
  INTERNAL_ERROR: 'Something went wrong on our side. Upload this file again later.',
} as const;

export type ReceiptErrorCode = keyof typeof RECEIPT_ERROR_MESSAGES;

export const REQUEST_ERROR_MESSAGES = {
  NO_FILES: 'Choose at least one file.',
  BATCH_TOO_LARGE: 'You can upload up to 20 files at a time.',
  RATE_LIMITED: 'You are going too fast. Wait a minute and try again.',
  MONTHLY_CAP_REACHED: 'You have reached this month’s limit of free receipts.',
  DAILY_CAPACITY_REACHED: 'We are at capacity for today. Try again tomorrow.',
} as const;

export type RequestErrorCode = keyof typeof REQUEST_ERROR_MESSAGES;

export const REQUEST_ERROR_STATUS: Record<RequestErrorCode, number> = {
  NO_FILES: 400,
  BATCH_TOO_LARGE: 400,
  RATE_LIMITED: 429,
  MONTHLY_CAP_REACHED: 429,
  DAILY_CAPACITY_REACHED: 503,
};

export class AppError extends Error {
  public readonly code: ReceiptErrorCode | RequestErrorCode;
  public readonly statusCode: number;

  constructor(code: ReceiptErrorCode | RequestErrorCode, statusCode?: number) {
    const message =
      code in RECEIPT_ERROR_MESSAGES
        ? RECEIPT_ERROR_MESSAGES[code as ReceiptErrorCode]
        : REQUEST_ERROR_MESSAGES[code as RequestErrorCode];
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? (code in REQUEST_ERROR_STATUS ? REQUEST_ERROR_STATUS[code as RequestErrorCode] : 500);
  }
}

export function getReceiptErrorMessage(code: ReceiptErrorCode): string {
  return RECEIPT_ERROR_MESSAGES[code] || RECEIPT_ERROR_MESSAGES.INTERNAL_ERROR;
}

export function getRequestErrorMessage(code: RequestErrorCode): string {
  return REQUEST_ERROR_MESSAGES[code] || 'An unexpected error occurred.';
}

