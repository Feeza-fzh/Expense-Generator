'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ReportResponse, FlagItem } from '@/lib/types';

interface ReportViewProps {
  batchId: string;
  onNewUpload: () => void;
}

export function ReportView({ batchId, onNewUpload }: ReportViewProps) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/batches/${batchId}/report`);
      if (!res.ok) {
        throw new Error('Could not load expense report.');
      }
      const data: ReportResponse = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading report');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Polling summary status if pending or processing
  useEffect(() => {
    if (report?.summaryStatus !== 'PENDING' && report?.summaryStatus !== 'PROCESSING') {
      return;
    }

    const interval = setInterval(async () => {
      await fetchReport();
    }, 2000);

    return () => clearInterval(interval);
  }, [report?.summaryStatus, fetchReport]);

  const handleRequestSummary = async () => {
    if (!report || report.includedCount === 0) return;

    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const res = await fetch(`/api/batches/${batchId}/summary`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setSummaryError(data.message || 'Could not request summary.');
        setSummaryLoading(false);
        return;
      }
      // Refresh report
      await fetchReport();
    } catch {
      setSummaryError('Network error while requesting summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleOpenSource = async (e: React.MouseEvent, receiptId: string) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/receipts/${receiptId}/source`);
      if (!res.ok) throw new Error('Could not get receipt source URL.');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      alert('Unable to load receipt source image.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-on-surface-variant animate-pulse">
        Loading expense report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700">
        <h3 className="font-semibold text-lg mb-1">Report Error</h3>
        <p className="text-sm">{error || 'Unable to view report.'}</p>
        <button
          onClick={onNewUpload}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  const { totals, receipts, summary, summaryStatus } = report;
  const currencies = Object.keys(totals.byCurrency || {});
  const failedReceipts = receipts.filter((r) => r.status === 'FAILED');

  const overviewItem = summary?.items.find((i) => i.anomalyType === 'BATCH_OVERVIEW');
  const anomalyItems = summary?.items.filter((i) => i.anomalyType !== 'BATCH_OVERVIEW') || [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Top Banner (FR-13) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-surface-c-lowest border border-on-surface-variant/20 shadow-sm">
        <div>
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-primary px-2.5 py-0.5 rounded bg-primary-container mb-1">
            Expense Report
          </span>
          <h2 className="text-2xl font-bold text-on-surface">
            {report.includedCount} of {report.totalCount} receipts included
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Scheduled for deletion on {new Date(report.expiresAt).toLocaleDateString()} (Retention policy)
          </p>
        </div>
        <div>
          <button
            onClick={onNewUpload}
            className="px-4 py-2 text-sm font-medium border border-on-surface-variant/30 rounded-lg hover:bg-surface-c-high transition-colors"
          >
            Upload New Batch
          </button>
        </div>
      </div>

      {/* Audit Summary Section (FR-18, FR-19) */}
      <div className="bg-surface-c-lowest border border-on-surface-variant/20 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Audit Summary</h3>
            <p className="text-xs text-on-surface-variant">
              Automated audit assistant highlights anomalies and pattern observations.
            </p>
          </div>
          <div>
            {summaryStatus === 'NOT_REQUESTED' && (
              <button
                disabled={report.includedCount === 0 || summaryLoading}
                onClick={handleRequestSummary}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {summaryLoading ? 'Requesting...' : 'Summarise for audit'}
              </button>
            )}
            {(summaryStatus === 'PENDING' || summaryStatus === 'PROCESSING') && (
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary-container text-on-primary-container animate-pulse">
                Summarising...
              </span>
            )}
            {summaryStatus === 'FAILED' && (
              <button
                onClick={handleRequestSummary}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Retry Summary
              </button>
            )}
          </div>
        </div>

        {report.includedCount === 0 && summaryStatus === 'NOT_REQUESTED' && (
          <p className="text-xs text-on-surface-variant italic">
            Summary is unavailable because no receipts were successfully extracted in this batch.
          </p>
        )}

        {summaryError && (
          <div className="p-3 mb-4 rounded bg-red-50 text-red-700 text-xs border border-red-200">
            {summaryError}
          </div>
        )}

        {summaryStatus === 'DONE' && summary && (
          <div className="space-y-4 mt-2">
            {overviewItem && (
              <div className="p-4 rounded-lg bg-surface-c-high border border-on-surface-variant/10">
                <span className="text-xs uppercase font-bold text-primary block mb-1">
                  Batch Overview
                </span>
                <p className="text-sm text-on-surface">{overviewItem.note}</p>
              </div>
            )}

            {anomalyItems.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Detected Anomalies ({anomalyItems.length})
                </h4>
                <div className="grid gap-2">
                  {anomalyItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-on-surface-variant/10 bg-surface-c-lowest flex items-start gap-3 text-sm"
                    >
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-c-high font-mono font-medium text-on-surface-variant">
                        {item.anomalyType}
                      </span>
                      <p className="text-on-surface flex-1">{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant italic">
                No specific receipt anomalies flagged by audit review.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Totals Section (FR-14: per currency and category) */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Expense Totals</h3>

        {currencies.length === 0 ? (
          <div className="p-6 bg-surface-c-lowest border border-on-surface-variant/20 rounded-xl text-center text-sm text-on-surface-variant">
            No valid totals available.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {currencies.map((currency) => {
              const currData = totals.byCurrency[currency];
              if (!currData) return null;
              const categories = Object.keys(currData.byCategory || {});

              return (
                <div
                  key={currency}
                  className="bg-surface-c-lowest border border-on-surface-variant/20 rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-baseline justify-between border-b border-on-surface-variant/10 pb-3">
                    <span className="text-sm font-semibold text-on-surface-variant tracking-wider">
                      {currency} Total ({currData.receiptCount} receipts)
                    </span>
                    <span className="text-2xl font-bold font-mono text-on-surface">
                      {currData.totalFormatted} {currency}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                      By Category
                    </h5>
                    <ul className="divide-y divide-on-surface-variant/10 text-sm">
                      {categories.map((cat) => {
                        const catData = currData.byCategory[cat];
                        if (!catData) return null;
                        return (
                          <li key={cat} className="py-2 flex items-center justify-between">
                            <span className="capitalize text-on-surface-variant">
                              {cat} ({catData.receiptCount})
                            </span>
                            <span className="font-mono font-medium text-on-surface">
                              {catData.totalFormatted}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Outside Totals Note (FR-14) */}
        {totals.outsideTotals.receiptCount > 0 && (
          <div className="p-4 rounded-lg bg-surface-c-high border border-on-surface-variant/20 text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">Note: </span>
            {totals.outsideTotals.receiptCount} included receipt(s) are outside the totals due to
            missing currency or unreadable amounts.
          </div>
        )}
      </div>

      {/* Per-Receipt Table (FR-15) */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Receipt Breakdown</h3>
        <div className="border border-on-surface-variant/20 rounded-xl overflow-hidden bg-surface-c-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-c-high text-xs uppercase text-on-surface-variant font-semibold border-b border-on-surface-variant/10">
                <tr>
                  <th className="px-4 py-3">Receipt / Merchant</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Tip</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-center">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-surface-variant/10">
                {receipts
                  .filter((r) => r.status === 'DONE')
                  .map((rcpt) => (
                    <tr key={rcpt.id} className="hover:bg-surface-c-high/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-on-surface block">
                          {rcpt.merchant || '—'}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {rcpt.originalFilename}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {rcpt.date || rcpt.dateRaw || '—'}
                      </td>
                      <td className="px-4 py-3 capitalize text-on-surface-variant">
                        {rcpt.category || 'unknown'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {rcpt.subtotalFormatted}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {rcpt.taxFormatted}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {rcpt.tipFormatted}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-on-surface">
                        {/* N-17: Every figure links to source receipt */}
                        {rcpt.sourceUrl ? (
                          <a
                            href={rcpt.sourceUrl}
                            onClick={(e) => handleOpenSource(e, rcpt.id)}
                            className="text-primary hover:underline"
                            title="View source receipt"
                          >
                            {rcpt.totalFormatted} {rcpt.currency || ''}
                          </a>
                        ) : (
                          `${rcpt.totalFormatted} ${rcpt.currency || ''}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rcpt.flags && rcpt.flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rcpt.flags.map((flag: FlagItem, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-c-high text-on-surface-variant border border-on-surface-variant/10"
                                title={flag.detail || flag.code}
                              >
                                {flag.code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-green-700">Clean</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rcpt.sourceUrl ? (
                          <button
                            type="button"
                            onClick={(e) => handleOpenSource(e, rcpt.id)}
                            className="text-xs text-primary underline hover:opacity-80"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Failed Receipts List (FR-13) */}
      {failedReceipts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider">
            Excluded Failed Files ({failedReceipts.length})
          </h4>
          <div className="border border-red-200 rounded-xl overflow-hidden bg-red-50/50">
            <ul className="divide-y divide-red-100 text-sm">
              {failedReceipts.map((rcpt) => (
                <li key={rcpt.id} className="p-4 flex items-center justify-between">
                  <span className="font-medium text-red-900">{rcpt.originalFilename}</span>
                  <span className="text-xs font-medium text-red-700">
                    {rcpt.errorMessage || 'File processing failed.'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Mandatory Legal & Retention Notice (FR-16, N-16) */}
      <footer className="pt-6 border-t border-on-surface-variant/10 text-center space-y-1">
        <p className="text-xs font-medium text-on-surface-variant">
          {report.legalNotice}
        </p>
        <p className="text-xs text-on-surface-variant/70">
          Scheduled for permanent deletion on {new Date(report.expiresAt).toLocaleDateString()}.
        </p>
      </footer>
    </div>
  );
}
