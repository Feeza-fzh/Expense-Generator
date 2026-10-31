'use client';

import React, { useEffect, useState } from 'react';
import { BatchStatusResponse } from '@/lib/types';

interface ProcessingViewProps {
  batchId: string;
  onReportReady: () => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PENDING') {
    return (
      <span className="label-small px-2.5 py-1 rounded-full" style={{ background: 'var(--color-surface-c-high)', color: 'var(--color-on-surface-variant)' }}>
        Queued
      </span>
    );
  }
  if (status === 'PROCESSING') {
    return (
      <span
        className="label-small px-2.5 py-1 rounded-full flex items-center gap-1.5"
        style={{ background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)' }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--color-primary)' }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--color-primary)' }} />
        </span>
        Reading
      </span>
    );
  }
  if (status === 'DONE') {
    return (
      <span className="label-small px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        Done
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="label-small px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Failed
      </span>
    );
  }
  return null;
}

export function ProcessingView({ batchId, onReportReady }: ProcessingViewProps) {
  const [statusData, setStatusData] = useState<BatchStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/batches/${batchId}/status`);
        if (!res.ok) {
          if (res.status === 404) { setError('Batch not found or expired.'); return; }
          throw new Error('Failed to fetch status');
        }
        const data: BatchStatusResponse = await res.json();
        if (isSubscribed) {
          setStatusData(data);
          if (data.reportReady) onReportReady();
        }
      } catch (err) {
        if (isSubscribed) setError(err instanceof Error ? err.message : 'Error polling status');
      }
    };

    pollStatus();
    // FR-6, TR-11: Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    return () => { isSubscribed = false; clearInterval(interval); };
  }, [batchId, onReportReady]);

  if (error) {
    return (
      <div className="card p-6 max-w-2xl mx-auto text-red-700 border-red-200 bg-red-50">
        <h3 className="title-medium mb-1">Status Check Error</h3>
        <p className="body-small">{error}</p>
      </div>
    );
  }

  const receipts = statusData?.receipts ?? [];
  const totalCount = receipts.length;
  const completedCount = receipts.filter((r) => r.status === 'DONE' || r.status === 'FAILED').length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto w-full">
      {/* Progress card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="title-large text-on-surface">Processing Receipts</h2>
            <p className="body-small mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              Reading receipt
            </p>
          </div>
          {/* Counter */}
          <div className="flex-shrink-0 text-right">
            <span className="heading-small font-mono" style={{ color: 'var(--color-primary)' }}>
              {completedCount}
              <span className="body-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                /{totalCount}
              </span>
            </span>
            <span className="label-small block" style={{ color: 'var(--color-on-surface-variant)' }}>
              completed
            </span>
          </div>
        </div>

        {/* Progress track */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-c-high)' }}>
          <div
            className="absolute left-0 top-0 h-2 rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--primitive-color-tertiary-60) 100%)',
            }}
          />
        </div>
        <p className="label-small mt-2 text-right" style={{ color: 'var(--color-on-surface-variant)' }}>
          {progressPct.toFixed(0)}% complete
        </p>
      </div>

      {/* Per-file status list */}
      <div className="card overflow-hidden">
        <div
          className="px-5 py-3 border-b label-large"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-on-surface-variant) 12%, transparent)',
            color: 'var(--color-on-surface-variant)',
          }}
        >
          Receipts in batch
        </div>
        <ul className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'color-mix(in srgb, var(--color-on-surface-variant) 10%, transparent)' }}>
          {receipts.length === 0 ? (
            <li className="px-5 py-8 text-center">
              <span className="dot-pulse flex justify-center gap-1.5">
                <span /><span /><span />
              </span>
              <p className="body-small mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>
                Waiting for batch information…
              </p>
            </li>
          ) : (
            receipts.map((rcpt) => (
              <li key={rcpt.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-neutral-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="body-medium truncate text-on-surface">{rcpt.originalFilename}</p>
                  {rcpt.errorMessage && (
                    <p className="label-small mt-0.5 text-red-600 truncate">{rcpt.errorMessage}</p>
                  )}
                </div>
                <StatusBadge status={rcpt.status} />
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
