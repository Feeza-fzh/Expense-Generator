export interface BatchReceiptStatus {
  id: string;
  originalFilename: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface BatchStatusResponse {
  batchId: string;
  reportReady: boolean;
  summaryStatus: 'NOT_REQUESTED' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  receipts: BatchReceiptStatus[];
}

export interface CategorySummary {
  totalMinor: number;
  totalFormatted: string;
  receiptCount: number;
}

export interface CurrencySummary {
  totalMinor: number;
  totalFormatted: string;
  receiptCount: number;
  byCategory: Record<string, CategorySummary>;
}

export interface FormattedReportTotals {
  byCurrency: Record<string, CurrencySummary>;
  outsideTotals: {
    receiptCount: number;
    receiptIds: string[];
  };
  includedCount: number;
  totalCount: number;
}

export interface ReportLineItem {
  position: number;
  description: string;
  quantity: string | null;
  amountMinor: number | null;
  amountFormatted: string;
}

export interface FlagItem {
  code: string;
  detail?: string;
  field?: string;
  differenceMinor?: number;
  otherReceiptId?: string;
  [key: string]: unknown;
}

export interface ReportReceiptRow {
  id: string;
  originalFilename: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  errorCode?: string | null;
  errorMessage?: string | null;
  merchant?: string | null;
  date?: string | null;
  dateRaw?: string | null;
  dateAmbiguous?: boolean;
  currency?: string | null;
  subtotalMinor?: number | null;
  subtotalFormatted: string;
  taxMinor?: number | null;
  taxFormatted: string;
  tipMinor?: number | null;
  tipFormatted: string;
  totalMinor?: number | null;
  totalFormatted: string;
  category?: string | null;
  legibility?: string | null;
  flags: FlagItem[];
  sourceUrl?: string | null;
  lineItems: ReportLineItem[];
}

export interface SummaryAnomalyItem {
  receiptId: string | null;
  anomalyType: string;
  note: string;
}

export interface BatchReportSummary {
  items: SummaryAnomalyItem[];
}

export interface ReportResponse {
  batchId: string;
  includedCount: number;
  totalCount: number;
  totals: FormattedReportTotals;
  summary?: BatchReportSummary | null;
  summaryStatus: 'NOT_REQUESTED' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  expiresAt: string;
  legalNotice: string;
  generatedAt: string;
  receipts: ReportReceiptRow[];
}

