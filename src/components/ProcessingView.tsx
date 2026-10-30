'use client';

import React, { useEffect, useState } from 'react';
import { BatchStatusResponse } from '@/lib/types';

interface ProcessingViewProps {
  batchId: string;
  onReportReady: () => void;
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
          if (res.status === 404) {
            setError('Batch not found or expired.');
            return;
          }
          throw new Error('Failed to fetch status');
        }

        const data: BatchStatusResponse = await res.json();
        if (isSubscribed) {
          setStatusData(data);
          if (data.reportReady) {
            onReportReady();
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Error polling status');
        }
      }
    };

    pollStatus();
    // FR-6, TR-11: Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [batchId, onReportReady]);

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700">
        <h3 className="font-semibold text-lg mb-1">Status Check Error</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const receipts = statusData?.receipts ?? [];
  const totalCount = receipts.length;
  const completedCount = receipts.filter(
    (r) => r.status === 'DONE' || r.status === 'FAILED'
  ).length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-surface-c-lowest border border-on-surface-variant/20 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Processing Receipts</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Reading receipt details with Gemini and running audit checks...
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary font-mono">
              {completedCount} / {totalCount}
            </span>
            <span className="block text-xs text-on-surface-variant uppercase tracking-wider">
              Files Completed
            </span>
          </div>
        </div>

        {/* Real counts only, no fake percentage bars (FR-6) */}
        <div className="w-full bg-surface-c-high rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 transition-all duration-500 rounded-full"
            style={{
              width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%',
            }}
          />
        </div>
      </div>

      <div className="bg-surface-c-lowest border border-on-surface-variant/20 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-on-surface-variant/10 font-medium text-sm text-on-surface-variant">
          Receipts in Batch
        </div>
        <ul className="divide-y divide-on-surface-variant/10 max-h-96 overflow-y-auto">
          {receipts.map((rcpt) => (
            <li key={rcpt.id} className="p-4 flex items-center justify-between text-sm">
              <div className="truncate mr-4">
                <p className="font-medium truncate">{rcpt.originalFilename}</p>
                {rcpt.errorMessage && (
                  <p className="text-xs text-red-600 mt-0.5">{rcpt.errorMessage}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {rcpt.status === 'PENDING' && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-surface-c-high text-on-surface-variant">
                    Queued
                  </span>
                )}
                {rcpt.status === 'PROCESSING' && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary-container text-on-primary-container animate-pulse flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    Reading
                  </span>
                )}
                {rcpt.status === 'DONE' && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Done
                  </span>
                )}
                {rcpt.status === 'FAILED' && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    Failed
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

