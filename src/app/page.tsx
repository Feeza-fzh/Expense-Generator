'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UploadView } from '@/components/UploadView';
import { ProcessingView } from '@/components/ProcessingView';
import { ReportView } from '@/components/ReportView';

function ExpenseSliceContent() {
  const searchParams = useSearchParams();
  const initialBatchId = searchParams.get('batch');

  const [currentBatchId, setCurrentBatchId] = useState<string | null>(initialBatchId);
  const [view, setView] = useState<'upload' | 'processing' | 'report'>(
    initialBatchId ? 'processing' : 'upload'
  );

  const handleUploadSuccess = (batchId: string) => {
    setCurrentBatchId(batchId);
    setView('processing');
  };

  const handleReportReady = () => {
    setView('report');
  };

  const handleNewUpload = () => {
    setCurrentBatchId(null);
    setView('upload');
  };

  return (
    <main
      className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col ${
        view === 'upload' ? 'justify-center py-6' : 'py-10'
      }`}
    >
      <header className="mb-8 text-center">
        <h1 className="heading-medium text-on-surface">
          Receipt to Expense Report
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant max-w-xl mx-auto">
          Turn raw receipt photos and PDFs into an organized, audit-traceable expense report.
        </p>
      </header>

      {view === 'upload' && <UploadView onUploadSuccess={handleUploadSuccess} />}

      {view === 'processing' && currentBatchId && (
        <ProcessingView
          batchId={currentBatchId}
          onReportReady={handleReportReady}
        />
      )}

      {view === 'report' && currentBatchId && (
        <ReportView batchId={currentBatchId} onNewUpload={handleNewUpload} />
      )}
    </main>
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
