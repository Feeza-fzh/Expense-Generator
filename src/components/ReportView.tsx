'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ReportResponse, FlagItem } from '@/lib/types';

interface ReportViewProps {
  batchId: string;
  onNewUpload: () => void;
}

// ── Flag badge colours keyed by flag code prefix ──────────────────────────────
const FLAG_COLOUR_MAP: Record<string, string> = {
  DUPLICATE: 'flag-badge flag-badge-warn',
  MISSING:   'flag-badge flag-badge-warn',
  AMBIGUOUS: 'flag-badge flag-badge-warn',
  HIGH:      'flag-badge flag-badge-warn',
  ROUND:     'flag-badge flag-badge-info',
  WEEKEND:   'flag-badge flag-badge-info',
  PERSONAL:  'flag-badge flag-badge-info',
  SPLIT:     'flag-badge flag-badge-info',
};

function flagClassName(code: string): string {
  const prefix = Object.keys(FLAG_COLOUR_MAP).find((k) => code.startsWith(k));
  return prefix ? FLAG_COLOUR_MAP[prefix]! : 'flag-badge flag-badge-info';
}

export function ReportView({ batchId, onNewUpload }: ReportViewProps) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/batches/${batchId}/report`);
      if (!res.ok) throw new Error('Could not load expense report.');
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

  const handleOpenSource = async (e: React.MouseEvent, receiptId: string) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/receipts/${receiptId}/source`);
      if (!res.ok) throw new Error('Could not get receipt source URL.');
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Unable to load receipt source image.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="dot-pulse flex gap-2"><span /><span /><span /></span>
        <p className="body-small" style={{ color: 'var(--color-on-surface-variant)' }}>Loading expenses…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="card p-6 max-w-2xl mx-auto border-red-200 bg-red-50 text-red-700">
        <h3 className="title-medium mb-1">Report Error</h3>
        <p className="body-small">{error ?? 'Unable to view report.'}</p>
        <button onClick={onNewUpload} className="btn-primary mt-4 text-sm" style={{ background: '#dc2626' }}>
          Back to Upload
        </button>
      </div>
    );
  }

  const { receipts } = report;
  const failedReceipts = receipts.filter((r) => r.status === 'FAILED');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 w-full">

      {/* ── Top Header (Renamed to Expenses, no subheading) ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="heading-medium text-on-surface">Expenses</h1>
          <p className="label-medium text-on-surface-variant mt-1">
            {report.includedCount} of {report.totalCount} receipts included
          </p>
        </div>
        <button onClick={onNewUpload} className="btn-ghost self-start sm:self-auto flex-shrink-0">
          + Upload New Batch
        </button>
      </div>

      {/* ── Per-receipt breakdown table ─────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead style={{ background: 'var(--color-surface-c-high)', borderBottom: '1px solid color-mix(in srgb, var(--color-on-surface-variant) 12%, transparent)' }}>
              <tr>
                {['Receipt / Merchant', 'Date', 'Category', 'Subtotal', 'Tax', 'Tip', 'Total', 'Flags', 'Source'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 label-medium uppercase whitespace-nowrap ${i >= 3 && i <= 6 ? 'text-right' : i === 8 ? 'text-center' : ''}`}
                    style={{ color: 'var(--color-on-surface-variant)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts
                .filter((r) => r.status === 'DONE')
                .map((rcpt) => (
                  <tr
                    key={rcpt.id}
                    className="transition-colors border-t"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-on-surface-variant) 8%, transparent)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-c-low)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    {/* Merchant / filename */}
                    <td className="px-4 py-3">
                      <span className="body-medium text-on-surface block">{rcpt.merchant ?? '—'}</span>
                      <span className="label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{rcpt.originalFilename}</span>
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 font-mono label-medium whitespace-nowrap" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {rcpt.date ?? rcpt.dateRaw ?? '—'}
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3 capitalize body-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                      {rcpt.category ?? 'unknown'}
                    </td>
                    {/* Subtotal */}
                    <td className="px-4 py-3 text-right font-mono label-medium text-on-surface">{rcpt.subtotalFormatted}</td>
                    {/* Tax */}
                    <td className="px-4 py-3 text-right font-mono label-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{rcpt.taxFormatted}</td>
                    {/* Tip */}
                    <td className="px-4 py-3 text-right font-mono label-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{rcpt.tipFormatted}</td>
                    {/* Total — links to source receipt */}
                    <td className="px-4 py-3 text-right font-mono label-large text-on-surface font-semibold">
                      {rcpt.sourceUrl ? (
                        <a
                          href={rcpt.sourceUrl}
                          onClick={(e) => handleOpenSource(e, rcpt.id)}
                          className="hover:underline"
                          style={{ color: 'var(--color-primary)' }}
                          title="View source receipt"
                        >
                          {rcpt.totalFormatted} {rcpt.currency ?? ''}
                        </a>
                      ) : (
                        <span>{rcpt.totalFormatted} {rcpt.currency ?? ''}</span>
                      )}
                    </td>
                    {/* Flags */}
                    <td className="px-4 py-3">
                      {rcpt.flags && rcpt.flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rcpt.flags.map((flag: FlagItem, i: number) => (
                            <span key={i} className={flagClassName(flag.code)} title={flag.detail ?? flag.code}>
                              {flag.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="flag-badge flag-badge-clean">Clean</span>
                      )}
                    </td>
                    {/* Source link */}
                    <td className="px-4 py-3 text-center">
                      {rcpt.sourceUrl ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenSource(e, rcpt.id)}
                          className="label-small underline underline-offset-2"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          View
                        </button>
                      ) : (
                        <span className="label-small" style={{ color: 'var(--color-on-surface-variant)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Failed receipts ────────────────────────────────────────────── */}
      {failedReceipts.length > 0 && (
        <div className="space-y-3">
          <h4 className="label-large uppercase text-red-700">
            Excluded / Failed Files ({failedReceipts.length})
          </h4>
          <div className="card border-red-200 overflow-hidden" style={{ background: '#fff8f8' }}>
            <ul className="divide-y divide-red-100">
              {failedReceipts.map((rcpt) => (
                <li key={rcpt.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <span className="body-medium text-red-900 truncate">{rcpt.originalFilename}</span>
                  <span className="label-small text-red-700 flex-shrink-0">
                    {rcpt.errorMessage ?? 'File processing failed.'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
