'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UploadView } from '@/components/UploadView';
import { ReportView } from '@/components/ReportView';

function ExpenseSliceContent() {
  const searchParams = useSearchParams();
  const initialBatchId = searchParams.get('batch');

  const [currentBatchId, setCurrentBatchId] = useState<string | null>(initialBatchId);
  const [view, setView] = useState<'upload' | 'report'>(
    initialBatchId ? 'report' : 'upload'
  );

  const handleProcessComplete = (batchId: string) => {
    setCurrentBatchId(batchId);
    setView('report');
  };

  const handleNewUpload = () => {
    setCurrentBatchId(null);
    setView('upload');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--primitive-color-tertiary-60) 100%)' }} />

      <main
        className={`flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col ${
          view === 'upload' ? 'justify-center py-12' : 'py-12'
        }`}
      >
        {view === 'upload' && (
          <header className="mb-10 text-center">
            <h1 className="heading-medium text-on-surface">
              Receipt to Expense Report
            </h1>
            <p className="mt-2 body-medium max-w-md mx-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
              Turn raw receipt photos and PDFs into an organised, audit-traceable expense report.
            </p>
          </header>
        )}

        {view === 'upload' && <UploadView onProcessComplete={handleProcessComplete} />}

        {view === 'report' && currentBatchId && (
          <ReportView batchId={currentBatchId} onNewUpload={handleNewUpload} />
        )}
      </main>

      {view === 'upload' && (
        <footer className="py-4 text-center label-small" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.6 }}>
          No data is shared with third parties · Files auto-deleted after 365 days
        </footer>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant">
          Loading...
        </div>
      }
    >
      <ExpenseSliceContent />
    </Suspense>
  );
}
